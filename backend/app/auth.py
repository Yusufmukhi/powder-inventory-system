from fastapi import Depends, Header, HTTPException
from app.database import supabase


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """
    Verifies the Supabase access token sent as 'Authorization: Bearer <token>'
    by asking Supabase itself to validate it (rather than decoding the JWT
    locally). Also resolves which company (if any) this user belongs to, and
    checks that company's subscription status.

    A 'super_admin' belongs to no company (company_id is None) and skips the
    subscription check entirely — they manage companies, not day-to-day data.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not logged in")

    token = authorization.split(" ", 1)[1]

    try:
        result = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session, please log in again")

    if not result or not result.user:
        raise HTTPException(status_code=401, detail="Invalid session, please log in again")

    user_id = result.user.id
    email = result.user.email

    profiles = (
        supabase.table("profiles")
        .select("*")
        .eq("id", user_id)
        .limit(1)
        .execute()
        .data
    )

    if profiles:
        profile = profiles[0]
        role = profile["role"]
        company_id = profile.get("company_id")
        username = profile.get("username") or (email.split("@")[0] if email else None)
    else:
        # Profile row missing (e.g. trigger hadn't run yet) — self-heal instead
        # of silently defaulting, so this can't quietly hide someone's real role.
        username = email.split("@")[0] if email else None
        supabase.table("profiles").upsert({
            "id": user_id, "email": email, "role": "shop_floor", "username": username,
        }).execute()
        role = "shop_floor"
        company_id = None

    if role != "super_admin":
        if not company_id:
            raise HTTPException(
                status_code=403,
                detail="Your account isn't attached to a company yet. Ask your administrator to fix this.",
            )
        company = (
            supabase.table("companies")
            .select("subscription_status")
            .eq("id", company_id)
            .limit(1)
            .execute()
            .data
        )
        if company and company[0]["subscription_status"] != "active":
            raise HTTPException(
                status_code=402,
                detail="SUBSCRIPTION_INACTIVE: This account is currently suspended. Contact your administrator.",
            )

    return {"id": user_id, "email": email, "username": username, "role": role, "company_id": company_id}


def require_owner(user: dict = Depends(get_current_user)) -> dict:
    """Use as a route dependency to restrict an endpoint to the Owner role."""
    if user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the Owner can do this")
    return user


def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    """Use as a route dependency to restrict an endpoint to the Super Admin (you)."""
    if user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Only a super admin can do this")
    return user
