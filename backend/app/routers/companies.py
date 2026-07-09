from fastapi import APIRouter, Depends, HTTPException
from app.database import supabase
from app.auth import require_super_admin
from app.schemas import CompanyCreate, CompanyUpdate
from app.audit import log_activity

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/")
def list_companies(user: dict = Depends(require_super_admin)):
    """Super-admin only: every company on this deployment, with seat usage."""
    companies = supabase.table("companies").select("*").order("created_at").execute().data
    profiles = supabase.table("profiles").select("company_id, role").execute().data

    for c in companies:
        members = [p for p in profiles if p["company_id"] == c["id"]]
        c["owner_count"] = sum(1 for p in members if p["role"] == "owner")
        c["staff_count"] = sum(1 for p in members if p["role"] == "shop_floor")

    return companies


@router.post("/")
def create_company(payload: CompanyCreate, user: dict = Depends(require_super_admin)):
    """
    Super-admin only: create a brand new company AND its first Owner account,
    in one step. This is the only way a new company comes into existence —
    Owners can never create one themselves, so everything a regular Owner does
    stays inside the one company you decided to put them in.
    """
    company_res = supabase.table("companies").insert({
        "name": payload.name,
        "max_owners": payload.max_owners,
        "max_staff": payload.max_staff,
    }).execute()
    if not company_res.data:
        raise HTTPException(status_code=400, detail="Could not create company")
    company = company_res.data[0]

    try:
        created = supabase.auth.admin.create_user({
            "email": payload.owner_email,
            "password": payload.owner_password,
            "email_confirm": True,
        })
        new_user_id = created.user.id
    except Exception as e:
        # Roll back the company so we don't leave an orphaned, owner-less company behind.
        supabase.table("companies").delete().eq("id", company["id"]).execute()
        raise HTTPException(status_code=400, detail=f"Could not create the first owner: {e}")

    try:
        supabase.table("profiles").upsert({
            "id": new_user_id,
            "email": payload.owner_email,
            "role": "owner",
            "company_id": company["id"],
        }).execute()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Company was created and the login exists, but attaching it as Owner failed: {e}. "
                f"Fix directly in Supabase SQL Editor with: "
                f"update profiles set role = 'owner', company_id = '{company['id']}' "
                f"where email = '{payload.owner_email}';"
            ),
        )

    company["owner_count"] = 1
    company["staff_count"] = 0
    log_activity(
        user, "company.created", "company", company["id"],
        {"name": payload.name, "owner_email": payload.owner_email},
        company_id=company["id"],
    )
    return company


@router.patch("/{company_id}")
def update_company(company_id: str, payload: CompanyUpdate, user: dict = Depends(require_super_admin)):
    """Super-admin only: rename a company, adjust seat limits, or suspend/reactivate it."""
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = supabase.table("companies").update(data).eq("id", company_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Company not found")

    action = "company.updated"
    if "subscription_status" in data:
        action = "company.suspended" if data["subscription_status"] == "suspended" else "company.reactivated"
    log_activity(user, action, "company", company_id, data, company_id=company_id)
    return res.data[0]
