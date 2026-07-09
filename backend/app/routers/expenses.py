from fastapi import APIRouter, HTTPException, Query, Depends
from datetime import date
import calendar
from app.database import supabase
from app.schemas import ExpenseCreate, AssetCreate
from app.auth import require_owner
from app.audit import log_activity

router = APIRouter(prefix="/expenses", tags=["expenses"])


def _month_range(month: str) -> tuple[date, date]:
    year, mon = map(int, month.split("-"))
    start = date(year, mon, 1)
    end = date(year, mon, calendar.monthrange(year, mon)[1])
    return start, end


def _resolve_range(month: str | None, from_date: str | None, to_date: str | None) -> tuple[date, date]:
    """Accepts either an explicit from/to range (used for Financial Year / custom
    reports) or a YYYY-MM month. from/to takes priority when both are given."""
    if from_date and to_date:
        return date.fromisoformat(from_date), date.fromisoformat(to_date)
    if month:
        return _month_range(month)
    raise HTTPException(status_code=400, detail="Provide either 'month' or 'from'/'to'")


@router.get("/")
def list_expenses(
    month: str | None = None,
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    user: dict = Depends(require_owner),
):
    """Filter by month (YYYY-MM) or an explicit from/to range (for FY view). If none given, returns everything."""
    query = (
        supabase.table("expenses")
        .select("*")
        .eq("company_id", user["company_id"])
        .order("expense_date", desc=True)
    )
    if month or (from_date and to_date):
        start, end = _resolve_range(month, from_date, to_date)
        query = query.gte("expense_date", str(start)).lte("expense_date", str(end))
    return query.execute().data


@router.post("/")
def create_expense(payload: ExpenseCreate, user: dict = Depends(require_owner)):
    data = payload.model_dump()
    data["expense_date"] = str(data["expense_date"])
    data["company_id"] = user["company_id"]
    res = supabase.table("expenses").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not add expense")
    return res.data[0]


@router.delete("/{expense_id}")
def delete_expense(expense_id: str, user: dict = Depends(require_owner)):
    existing = (
        supabase.table("expenses").select("*").eq("id", expense_id).eq("company_id", user["company_id"]).execute().data
    )
    supabase.table("expenses").delete().eq("id", expense_id).eq("company_id", user["company_id"]).execute()
    if existing:
        log_activity(user, "expense.deleted", "expense", expense_id, {
            "category": existing[0]["category"], "amount": existing[0]["amount"], "expense_date": existing[0]["expense_date"],
        })
    return {"deleted": True}


@router.get("/assets/list")
def list_assets(user: dict = Depends(require_owner)):
    """Returns depreciable assets and land/capital purchases together, each with
    a computed book value so the frontend can show a proper fixed-asset register."""
    assets = (
        supabase.table("assets")
        .select("*")
        .eq("company_id", user["company_id"])
        .order("purchase_date", desc=True)
        .execute()
        .data
    )
    today = date.today()
    for a in assets:
        if a["asset_type"] == "land" or not a.get("useful_life_years"):
            a["monthly_depreciation"] = 0
            a["accumulated_depreciation"] = 0
            a["book_value"] = a["purchase_price"]
        else:
            monthly_dep = a["purchase_price"] / (a["useful_life_years"] * 12)
            purchase_dt = date.fromisoformat(a["purchase_date"])
            months_owned = max(
                0,
                (today.year - purchase_dt.year) * 12 + (today.month - purchase_dt.month),
            )
            accumulated = min(a["purchase_price"], round(monthly_dep * months_owned, 2))
            a["monthly_depreciation"] = round(monthly_dep, 2)
            a["accumulated_depreciation"] = accumulated
            a["book_value"] = round(a["purchase_price"] - accumulated, 2)
    return assets


@router.post("/assets")
def create_asset(payload: AssetCreate, user: dict = Depends(require_owner)):
    data = payload.model_dump()
    data["purchase_date"] = str(data["purchase_date"])
    data["company_id"] = user["company_id"]
    if data["asset_type"] == "land":
        data["useful_life_years"] = None  # land doesn't depreciate
    res = supabase.table("assets").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not add asset")
    return res.data[0]


@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: str, user: dict = Depends(require_owner)):
    existing = (
        supabase.table("assets").select("*").eq("id", asset_id).eq("company_id", user["company_id"]).execute().data
    )
    supabase.table("assets").delete().eq("id", asset_id).eq("company_id", user["company_id"]).execute()
    if existing:
        log_activity(user, "asset.deleted", "asset", asset_id, {
            "name": existing[0]["name"], "purchase_price": existing[0]["purchase_price"],
        })
    return {"deleted": True}


def _monthly_depreciation(company_id: str) -> float:
    """Only depreciable assets reduce monthly profit. Land/capital purchases don't."""
    assets = (
        supabase.table("assets")
        .select("*")
        .eq("company_id", company_id)
        .eq("asset_type", "depreciable")
        .execute()
        .data
    )
    total = 0.0
    for a in assets:
        years = a.get("useful_life_years") or 1
        total += a["purchase_price"] / (years * 12)
    return round(total, 2)


@router.get("/summary")
def summary(
    month: str | None = None,
    from_date: str | None = Query(default=None, alias="from"),
    to_date: str | None = Query(default=None, alias="to"),
    label: str | None = None,
    user: dict = Depends(require_owner),
):
    """
    Profit & Loss summary for either a month (YYYY-MM) or an explicit from/to
    range (used for Financial Year reports). Land / capital purchases are
    intentionally excluded from this P&L — they belong on the balance sheet,
    not as a monthly expense.
    """
    start, end = _resolve_range(month, from_date, to_date)
    company_id = user["company_id"]

    jobs = (
        supabase.table("jobs")
        .select("price_charged, powder_cost, date_completed")
        .eq("company_id", company_id)
        .gte("date_completed", str(start))
        .lte("date_completed", str(end))
        .execute()
        .data
    )
    revenue = round(sum(j["price_charged"] or 0 for j in jobs), 2)
    powder_cost = round(sum(j["powder_cost"] or 0 for j in jobs), 2)
    gross_profit = round(revenue - powder_cost, 2)

    expenses = (
        supabase.table("expenses")
        .select("*")
        .eq("company_id", company_id)
        .gte("expense_date", str(start))
        .lte("expense_date", str(end))
        .execute()
        .data
    )
    by_category: dict[str, float] = {}
    for e in expenses:
        by_category[e["category"]] = by_category.get(e["category"], 0) + e["amount"]
    total_expenses = round(sum(by_category.values()), 2)

    monthly_dep = _monthly_depreciation(company_id)
    months_in_range = max(1, (end.year - start.year) * 12 + (end.month - start.month) + 1)
    period_depreciation = round(monthly_dep * months_in_range, 2) if month is None else monthly_dep

    net_profit = round(gross_profit - total_expenses - period_depreciation, 2)

    # Capital purchases (land etc.) made within this period — shown separately, not part of P&L
    capital_purchases = (
        supabase.table("assets")
        .select("*")
        .eq("company_id", company_id)
        .eq("asset_type", "land")
        .gte("purchase_date", str(start))
        .lte("purchase_date", str(end))
        .execute()
        .data
    )
    total_capital_purchases = round(sum(a["purchase_price"] for a in capital_purchases), 2)

    return {
        "label": label or month or f"{start.isoformat()} to {end.isoformat()}",
        "period_start": str(start),
        "period_end": str(end),
        "revenue": revenue,
        "powder_cost": powder_cost,
        "gross_profit": gross_profit,
        "expenses_by_category": by_category,
        "total_expenses": total_expenses,
        "depreciation": period_depreciation,
        "net_profit": net_profit,
        "capital_purchases": capital_purchases,
        "total_capital_purchases": total_capital_purchases,
    }
