from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app.schemas import SupplierCreate
from app.auth import get_current_user

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("/")
def list_suppliers(user: dict = Depends(get_current_user)):
    res = (
        supabase.table("suppliers")
        .select("*")
        .eq("company_id", user["company_id"])
        .order("name")
        .execute()
    )
    return res.data


@router.post("/")
def create_supplier(payload: SupplierCreate, user: dict = Depends(get_current_user)):
    # avoid duplicate names (case-insensitive) within this company so the dropdown stays clean
    existing = (
        supabase.table("suppliers")
        .select("*")
        .eq("company_id", user["company_id"])
        .ilike("name", payload.name.strip())
        .execute()
        .data
    )
    if existing:
        return existing[0]

    res = supabase.table("suppliers").insert({
        "name": payload.name.strip(),
        "contact_number": payload.contact_number,
        "company_id": user["company_id"],
    }).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not create supplier")
    return res.data[0]
