from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from app.database import supabase
from app.schemas import JobCreate, JobEdit, JobApprove, PaymentUpdate
from app.auth import get_current_user, require_owner
from app.audit import log_activity
from app.schemas import JobCreate, JobEdit, JobApprove, PaymentUpdate, PaymentEntryCreate

router = APIRouter(prefix="/jobs", tags=["jobs"])

EDITABLE_STATUSES = ("received", "in_process")


def _generate_job_number(company_id: str) -> str:
    year = datetime.now().year
    prefix = f"PC-{year}-"
    res = (
        supabase.table("jobs")
        .select("job_number")
        .eq("company_id", company_id)
        .like("job_number", f"{prefix}%")
        .order("job_number", desc=True)
        .limit(1)
        .execute()
    )
    if res.data:
        last_seq = int(res.data[0]["job_number"].split("-")[-1])
        seq = last_seq + 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


def _consume_powder_fifo(powder_id: str, qty_needed: float, job_id: str) -> float:
    """
    Draws from the oldest batches first. Runs as a single atomic Postgres
    transaction (see consume_powder_fifo in migration_v4_auth_rls.sql) so two
    jobs approved for the same powder at the same time can't double-spend
    the same stock.
    """
    try:
        res = supabase.rpc(
            "consume_powder_fifo",
            {"p_powder_id": powder_id, "p_qty_needed": qty_needed, "p_job_id": job_id},
        ).execute()
    except Exception as e:
        # Postgres raises a plain exception for insufficient stock; surface it as a 400
        raise HTTPException(status_code=400, detail=str(e))

    return round(res.data, 2)


def _get_owned_job(job_id: str, company_id: str) -> dict:
    job = (
        supabase.table("jobs")
        .select("*")
        .eq("id", job_id)
        .eq("company_id", company_id)
        .limit(1)
        .execute()
        .data
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job[0]


@router.get("/")
def list_jobs(status: str | None = None, user: dict = Depends(get_current_user)):
    query = (
        supabase.table("jobs")
        .select("*, customers(name), powders(shade_name)")
        .eq("company_id", user["company_id"])
        .order("date_received", desc=True)
    )
    if status:
        query = query.eq("status", status)
    jobs = query.execute().data

    for j in jobs:
        j["customer_name"] = (j.pop("customers", None) or {}).get("name")
        j["shade_name"] = (j.pop("powders", None) or {}).get("shade_name")
        j["was_late"] = bool(
            j.get("date_completed") and j["date_completed"] > j["date_promised"]
        )
    return jobs


@router.get("/{job_id}")
def get_job(job_id: str, user: dict = Depends(get_current_user)):
    j = (
        supabase.table("jobs")
        .select("*, customers(name), powders(shade_name)")
        .eq("id", job_id)
        .eq("company_id", user["company_id"])
        .limit(1)
        .execute()
        .data
    )
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    j = j[0]
    j["customer_name"] = (j.pop("customers", None) or {}).get("name")
    j["shade_name"] = (j.pop("powders", None) or {}).get("shade_name")
    return j


@router.post("/")
def create_job(payload: JobCreate, user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    data["date_received"] = str(data["date_received"])
    data["date_promised"] = str(data["date_promised"])
    data["job_number"] = _generate_job_number(user["company_id"])
    data["status"] = "received"
    data["company_id"] = user["company_id"]

    res = supabase.table("jobs").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Could not create job")
    return res.data[0]


@router.patch("/{job_id}")
def edit_job(job_id: str, payload: JobEdit, user: dict = Depends(get_current_user)):
    """Editable only before approval. Once approved (or delivered), no more edits."""
    existing = _get_owned_job(job_id, user["company_id"])
    if existing["status"] not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail="This job is already approved and can no longer be edited")

    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "date_promised" in data:
        data["date_promised"] = str(data["date_promised"])
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = supabase.table("jobs").update(data).eq("id", job_id).execute()
    log_activity(user, "job.edited", "job", job_id, {"job_number": existing["job_number"], "fields": list(data.keys())})
    return res.data[0]

@router.patch("/{job_id}/start")
def start_job(job_id: str, user: dict = Depends(get_current_user)):
    """Moves a job from 'received' into 'in_process' — marks that work has begun."""
    job = _get_owned_job(job_id, user["company_id"])
    if job["status"] != "received":
        raise HTTPException(status_code=400, detail="Only newly received jobs can be moved to in progress")
    res = supabase.table("jobs").update({"status": "in_process"}).eq("id", job_id).execute()
    log_activity(user, "job.started", "job", job_id, {"job_number": job["job_number"]})
    return res.data[0]
@router.post("/{job_id}/approve")
def approve_job(job_id: str, payload: JobApprove, user: dict = Depends(require_owner)):
    """
    Approve — only asks completion date, powder consumed, and price charged.
    Powder cost is computed automatically from stock batches (oldest first) and
    that quantity is deducted from stock. Job moves to 'approved' and can't be
    edited or re-approved after this.
    """
    job = _get_owned_job(job_id, user["company_id"])
    if job["status"] not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail="This job has already been approved")

    powder_cost = _consume_powder_fifo(job["powder_id"], payload.powder_consumed_kg, job_id)

    update_data = {
        "date_completed": str(payload.date_completed),
        "powder_consumed_kg": payload.powder_consumed_kg,
        "powder_cost": powder_cost,
        "price_charged": payload.price_charged,
        "status": "approved",
    }
    res = supabase.table("jobs").update(update_data).eq("id", job_id).execute()
    log_activity(
        user, "job.approved", "job", job_id,
        {
            "job_number": job["job_number"],
            "powder_consumed_kg": payload.powder_consumed_kg,
            "powder_cost": powder_cost,
            "price_charged": payload.price_charged,
        },
    )
    return res.data[0]


@router.patch("/{job_id}/deliver")
def mark_delivered(job_id: str, user: dict = Depends(get_current_user)):
    job = _get_owned_job(job_id, user["company_id"])
    if job["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved jobs can be marked delivered")
    res = supabase.table("jobs").update({"status": "delivered"}).eq("id", job_id).execute()
    return res.data[0]


@router.patch("/{job_id}/payment")
def update_payment(job_id: str, payload: PaymentUpdate, user: dict = Depends(get_current_user)):
    job = _get_owned_job(job_id, user["company_id"])
    data = {"payment_status": payload.payment_status}
    if payload.payment_method is not None:
        data["payment_method"] = payload.payment_method
    if payload.advance_amount is not None:
        data["advance_amount"] = payload.advance_amount
    res = supabase.table("jobs").update(data).eq("id", job_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Job not found")
    log_activity(user, "job.payment_updated", "job", job_id, {"job_number": job["job_number"], **data})
    return res.data[0]
@router.post("/{job_id}/payments")
def add_payment(job_id: str, payload: PaymentEntryCreate, user: dict = Depends(get_current_user)):
    """
    Records a single payment received against a job (e.g. a ₹500 advance today,
    then a ₹1,500 balance payment later — each is its own saved entry, nothing
    is overwritten). The job's advance_amount and payment_status are then
    recalculated from the sum of all payments on this job.
    """
    job = _get_owned_job(job_id, user["company_id"])

    entry = {
        "job_id": job_id,
        "company_id": user["company_id"],
        "amount": payload.amount,
        "payment_method": payload.payment_method,
        "paid_date": str(payload.paid_date) if payload.paid_date else str(datetime.now().date()),
        "created_by": user["id"],
    }
    supabase.table("job_payments").insert(entry).execute()

    payments = (
        supabase.table("job_payments")
        .select("amount")
        .eq("job_id", job_id)
        .execute()
        .data
    )
    total_paid = round(sum(p["amount"] for p in payments), 2)
    price_charged = job.get("price_charged") or 0

    if price_charged and total_paid >= price_charged:
        new_status = "paid"
    elif total_paid > 0:
        new_status = "advance"
    else:
        new_status = "unpaid"

    update_data = {
        "advance_amount": total_paid,
        "payment_status": new_status,
        "payment_method": payload.payment_method,
    }
    res = supabase.table("jobs").update(update_data).eq("id", job_id).execute()
    log_activity(
        user, "job.payment_added", "job", job_id,
        {"job_number": job["job_number"], "amount": payload.amount, "total_paid": total_paid, "new_status": new_status},
    )
    return res.data[0]


@router.get("/{job_id}/payments")
def list_payments(job_id: str, user: dict = Depends(get_current_user)):
    """Full payment history for a job, most recent first."""
    _get_owned_job(job_id, user["company_id"])
    return (
        supabase.table("job_payments")
        .select("*")
        .eq("job_id", job_id)
        .order("paid_date", desc=True)
        .order("created_at", desc=True)
        .execute()
        .data
    )


@router.patch("/{job_id}/payment")
def update_payment(job_id: str, payload: PaymentUpdate, user: dict = Depends(get_current_user)):
    """
    Kept for directly setting a status without a specific payment entry
    (e.g. marking something 'unpaid' again, or a manual correction). Prefer
    POST /jobs/{job_id}/payments for recording an actual payment received.
    """
    job = _get_owned_job(job_id, user["company_id"])
    data = {"payment_status": payload.payment_status}
    if payload.payment_method is not None:
        data["payment_method"] = payload.payment_method
    if payload.advance_amount is not None:
        data["advance_amount"] = payload.advance_amount
    res = supabase.table("jobs").update(data).eq("id", job_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Job not found")
    log_activity(user, "job.payment_updated", "job", job_id, {"job_number": job["job_number"], **data})
    return res.data[0]


@router.get("/dashboard/summary")
def dashboard_summary(user: dict = Depends(get_current_user)):
    jobs = supabase.table("jobs").select("*").eq("company_id", user["company_id"]).execute().data
    pending = [j for j in jobs if j["status"] in EDITABLE_STATUSES]
    late = [j for j in jobs if j.get("date_completed") and j["date_completed"] > j["date_promised"]]
    unpaid_value = sum(
        (j["price_charged"] or 0) - (j["advance_amount"] or 0)
        for j in jobs if j["payment_status"] != "paid" and j["price_charged"]
    )
    powders = supabase.table("powders").select("*").eq("company_id", user["company_id"]).execute().data
    low_stock = []
    for p in powders:
        batches = supabase.table("powder_batches").select("remaining_qty_kg").eq("powder_id", p["id"]).execute().data
        stock = sum(b["remaining_qty_kg"] for b in batches)
        if stock <= p["reorder_threshold_kg"]:
            p["stock_kg"] = round(stock, 3)
            low_stock.append(p)

    return {
        "total_jobs": len(jobs),
        "pending_jobs": len(pending),
        "late_jobs": len(late),
        "outstanding_receivables": round(unpaid_value, 2),
        "low_stock_powders": low_stock,
    }
