from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase
from app.schemas import CustomerCreate
from app.auth import get_current_user

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/")
def list_customers(user: dict = Depends(get_current_user)):
    res = (
        supabase.table("customers")
        .select("*")
        .eq("company_id", user["company_id"])
        .order("name")
        .execute()
    )
    return res.data


@router.post("/")
def create_customer(payload: CustomerCreate, user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    data["company_id"] = user["company_id"]
    res = supabase.table("customers").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not create customer")
    return res.data[0]


@router.get("/{customer_id}")
def get_customer(customer_id: str, user: dict = Depends(get_current_user)):
    res = (
        supabase.table("customers")
        .select("*")
        .eq("id", customer_id)
        .eq("company_id", user["company_id"])
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    return res.data[0]
