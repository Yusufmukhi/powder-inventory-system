from fastapi import APIRouter, HTTPException, Query, Depends
from datetime import date, datetime, timedelta
from app.database import supabase
from app.schemas import PowderCreate, PowderBatchCreate
from app.auth import get_current_user

router = APIRouter(prefix="/powders", tags=["powders"])


def _stock_for(powder_id: str) -> float:
    batches = (
        supabase.table("powder_batches")
        .select("remaining_qty_kg")
        .eq("powder_id", powder_id)
        .execute()
        .data
    )
    return round(sum(b["remaining_qty_kg"] for b in batches), 3)


def _get_owned_powder(powder_id: str, company_id: str) -> dict:
    powder = (
        supabase.table("powders")
        .select("*")
        .eq("id", powder_id)
        .eq("company_id", company_id)
        .limit(1)
        .execute()
        .data
    )
    if not powder:
        raise HTTPException(status_code=404, detail="Powder not found")
    return powder[0]


@router.get("/")
def list_powders(user: dict = Depends(get_current_user)):
    powders = (
        supabase.table("powders")
        .select("*")
        .eq("company_id", user["company_id"])
        .order("shade_name")
        .execute()
        .data
    )

    # Fetch remaining stock for ALL powders in a single query instead of
    # one query per powder (this was previously N+1: 1 call for the powder
    # list + 1 extra call per powder just to sum its batches).
    powder_ids = [p["id"] for p in powders]
    stock_by_powder: dict[str, float] = {pid: 0.0 for pid in powder_ids}
    if powder_ids:
        batches = (
            supabase.table("powder_batches")
            .select("powder_id, remaining_qty_kg")
            .in_("powder_id", powder_ids)
            .execute()
            .data
        )
        for b in batches:
            stock_by_powder[b["powder_id"]] = stock_by_powder.get(b["powder_id"], 0.0) + b["remaining_qty_kg"]

    for p in powders:
        p["stock_kg"] = round(stock_by_powder.get(p["id"], 0.0), 3)
        p["low_stock"] = p["stock_kg"] <= p["reorder_threshold_kg"]
    return powders


@router.post("/")
def create_powder(payload: PowderCreate, user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    data["company_id"] = user["company_id"]
    res = supabase.table("powders").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not create powder")
    powder = res.data[0]
    powder["stock_kg"] = 0
    powder["low_stock"] = True
    return powder


@router.post("/stock-in")
def add_stock(payload: PowderBatchCreate, user: dict = Depends(get_current_user)):
    """Record a new incoming batch (this is the FIFO lot used later at consumption)."""
    _get_owned_powder(payload.powder_id, user["company_id"])

    data = {
        "powder_id": payload.powder_id,
        "supplier_id": payload.supplier_id,
        "qty_kg": payload.qty_kg,
        "remaining_qty_kg": payload.qty_kg,
        "price_per_kg": payload.price_per_kg,
        "purchase_date": str(payload.purchase_date or date.today()),
        "notes": payload.notes,
        "company_id": user["company_id"],
    }
    res = supabase.table("powder_batches").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not add stock")
    return res.data[0]


@router.get("/{powder_id}/movements")
def get_movements(powder_id: str, days: int = Query(default=30), user: dict = Depends(get_current_user)):
    """
    Combined 'added' + 'used' history for the stock popup.
    days=30 default (last month). Pass a larger number or a big value for 'all time'.
    """
    _get_owned_powder(powder_id, user["company_id"])
    since = (datetime.utcnow() - timedelta(days=days)).date()

    batches = (
        supabase.table("powder_batches")
        .select("*, suppliers(name)")
        .eq("powder_id", powder_id)
        .gte("purchase_date", str(since))
        .order("purchase_date", desc=True)
        .execute()
        .data
    )
    added = [
        {
            "type": "added",
            "date": b["purchase_date"],
            "qty_kg": b["qty_kg"],
            "price_per_kg": b["price_per_kg"],
            "supplier_name": (b.get("suppliers") or {}).get("name"),
            "notes": b.get("notes"),
        }
        for b in batches
    ]

    batch_ids = [b["id"] for b in
                 supabase.table("powder_batches").select("id").eq("powder_id", powder_id).execute().data]

    used = []
    if batch_ids:
        lots = (
            supabase.table("powder_consumption_lots")
            .select("*, jobs(job_number)")
            .in_("batch_id", batch_ids)
            .gte("created_at", str(since))
            .order("created_at", desc=True)
            .execute()
            .data
        )
        used = [
            {
                "type": "used",
                "date": l["created_at"][:10],
                "qty_kg": l["qty_kg"],
                "price_per_kg": l["price_per_kg"],
                "job_number": (l.get("jobs") or {}).get("job_number"),
            }
            for l in lots
        ]

    combined = added + used
    combined.sort(key=lambda x: x["date"], reverse=True)
    return combined


@router.get("/low-stock")
def low_stock(user: dict = Depends(get_current_user)):
    powders = supabase.table("powders").select("*").eq("company_id", user["company_id"]).execute().data

    powder_ids = [p["id"] for p in powders]
    stock_by_powder: dict[str, float] = {pid: 0.0 for pid in powder_ids}
    if powder_ids:
        batches = (
            supabase.table("powder_batches")
            .select("powder_id, remaining_qty_kg")
            .in_("powder_id", powder_ids)
            .execute()
            .data
        )
        for b in batches:
            stock_by_powder[b["powder_id"]] = stock_by_powder.get(b["powder_id"], 0.0) + b["remaining_qty_kg"]

    result = []
    for p in powders:
        stock = round(stock_by_powder.get(p["id"], 0.0), 3)
        if stock <= p["reorder_threshold_kg"]:
            p["stock_kg"] = stock
            result.append(p)
    return result
    
