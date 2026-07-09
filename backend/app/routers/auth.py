from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user, require_owner
from app.database import supabase
from app.schemas import UserCreate, PasswordReset, PasswordChange
from app.audit import log_activity

router = APIRouter(prefix="/auth", tags=["auth"])

MIN_PASSWORD_LENGTH = 6


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return user


def _company(company_id: str) -> dict:
    rows = supabase.table("companies").select("*").eq("id", company_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=500, detail="Your company record is missing — contact your administrator.")
    return rows[0]


@router.get("/users")
def list_users(user: dict = Depends(require_owner)):
    """Owner-only: see every account in YOUR company (and only your company), plus seat usage."""
    profiles = (
        supabase.table("profiles")
        .select("*")
        .eq("company_id", user["company_id"])
        .order("created_at")
        .execute()
        .data
    )
    company = _company(user["company_id"])
    owners = [p for p in profiles if p["role"] == "owner"]
    staff = [p for p in profiles if p["role"] == "shop_floor"]
    return {
        "users": profiles,
        "company_name": company["name"],
        "owner_count": len(owners),
        "staff_count": len(staff),
        "max_owners": company["max_owners"],
        "max_staff": company["max_staff"],
        "subscription_status": company["subscription_status"],
    }


@router.post("/users")
def create_user(payload: UserCreate, user: dict = Depends(require_owner)):
    """
    Owner-only: invite a new account into YOUR OWN company. There is no public
    signup, and an Owner can never create a user in any other company — the
    new account is always attached to user["company_id"] automatically.
    """
    if payload.role not in ("owner", "shop_floor"):
        raise HTTPException(status_code=400, detail="Role must be 'owner' or 'shop_floor'")

    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    company_id = user["company_id"]
    company = _company(company_id)
    profiles = supabase.table("profiles").select("role").eq("company_id", company_id).execute().data
    owner_count = sum(1 for p in profiles if p["role"] == "owner")
    staff_count = sum(1 for p in profiles if p["role"] == "shop_floor")

    if payload.role == "owner" and owner_count >= company["max_owners"]:
        raise HTTPException(
            status_code=400,
            detail=f"Owner seat limit reached ({company['max_owners']}). Remove an existing Owner first or ask your administrator to raise the limit.",
        )
    if payload.role == "shop_floor" and staff_count >= company["max_staff"]:
        raise HTTPException(
            status_code=400,
            detail=f"Staff seat limit reached ({company['max_staff']}). Remove an existing staff account first or ask your administrator to raise the limit.",
        )

    try:
        created = supabase.auth.admin.create_user({
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,  # no email verification step needed for an internal tool
        })
        new_user_id = created.user.id
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not create user: {e}")

    # A DB trigger also creates a profile row (defaulting to 'shop_floor', no
    # company) the moment the auth account is created. Using upsert here —
    # instead of update — means this works correctly whether that trigger has
    # already run or not, AND it's what actually attaches the new account to
    # YOUR company. Without this, the account would exist but belong to no
    # company at all.
    try:
        supabase.table("profiles").upsert({
            "id": new_user_id,
            "email": payload.email,
            "username": username,
            "role": payload.role,
            "company_id": company_id,
        }).execute()
    except Exception as e:
        # Roll back the just-created auth account so we don't leave a login
        # that exists but was never actually attached to this company
        # (this is most commonly a duplicate username within the company).
        try:
            supabase.auth.admin.delete_user(new_user_id)
        except Exception:
            pass
        msg = str(e)
        if "username" in msg.lower() and ("duplicate" in msg.lower() or "unique" in msg.lower()):
            raise HTTPException(status_code=400, detail=f"Username '{username}' is already taken in your company. Pick another.")
        raise HTTPException(status_code=500, detail=f"Could not create account: {msg}")

    log_activity(
        user, "user.created", "user", new_user_id,
        {"email": payload.email, "username": username, "role": payload.role},
    )
    return {"id": new_user_id, "email": payload.email, "username": username, "role": payload.role}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, user: dict = Depends(require_owner)):
    """Owner-only: remove an account — but only if it belongs to your own company."""
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="You can't remove your own account while logged in as it.")

    target = (
        supabase.table("profiles")
        .select("id, email, username, company_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
        .data
    )
    if not target or target[0]["company_id"] != user["company_id"]:
        raise HTTPException(status_code=404, detail="User not found in your company")

    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not remove user: {e}")

    log_activity(user, "user.removed", "user", user_id, {"email": target[0]["email"], "username": target[0].get("username")})
    return {"deleted": True}


@router.patch("/users/{user_id}/password")
def reset_user_password(user_id: str, payload: PasswordReset, user: dict = Depends(require_owner)):
    """
    Owner-only: reset a forgotten password for someone in YOUR company. Sets
    it directly to a new temporary password (no email step needed) — same
    idea as when the account was first created, just share the new one with
    them directly.
    """
    if len(payload.new_password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")

    target = (
        supabase.table("profiles")
        .select("id, email, username, company_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
        .data
    )
    if not target or target[0]["company_id"] != user["company_id"]:
        raise HTTPException(status_code=404, detail="User not found in your company")

    try:
        supabase.auth.admin.update_user_by_id(user_id, {"password": payload.new_password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not reset password: {e}")

    log_activity(user, "user.password_reset", "user", user_id, {"email": target[0]["email"], "username": target[0].get("username")})
    return {"reset": True}


@router.post("/me/password")
def change_my_password(payload: PasswordChange, user: dict = Depends(get_current_user)):
    """
    Any logged-in user (Owner or Staff) changing their own password. Verifies
    the current password first by attempting a real sign-in with it, so
    someone can't change a password just by having a stolen, still-valid
    session token.
    """
    if len(payload.new_password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"New password must be at least {MIN_PASSWORD_LENGTH} characters")

    try:
        supabase.auth.sign_in_with_password({"email": user["email"], "password": payload.current_password})
    except Exception:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    try:
        supabase.auth.admin.update_user_by_id(user["id"], {"password": payload.new_password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not change password: {e}")

    log_activity(user, "user.password_changed", "user", user["id"], {})
    return {"changed": True}


@router.get("/activity-log")
def activity_log(limit: int = 200, user: dict = Depends(require_owner)):
    """Owner-only: the audit trail for YOUR company, most recent first."""
    rows = (
        supabase.table("activity_log")
        .select("*")
        .eq("company_id", user["company_id"])
        .order("created_at", desc=True)
        .limit(min(limit, 500))
        .execute()
        .data
    )
    return rows
