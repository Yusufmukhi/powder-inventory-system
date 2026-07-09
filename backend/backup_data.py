"""
Backup script — exports every table to a single timestamped JSON file, and
(by default) also uploads that file to a Supabase Storage bucket.

Why this exists: Supabase's automatic Point-in-Time-Recovery backups are only
included on paid tiers. On the free tier, if something goes wrong (accidental
delete, bad migration, etc.) there is no built-in way back. Run this
regularly and keep the output somewhere safe.

Why it uploads to Storage: if this runs as a scheduled job on Render (a Cron
Job, or a Background Worker with a sleep loop), each run gets a fresh,
ephemeral filesystem — anything written to backend/backups/ locally is gone
the moment the job finishes. Storage is the actual persistent copy; the local
file is just a convenience when you run this by hand.

Usage (manual, one-off):
    cd backend
    python backup_data.py                # writes local file AND uploads to Storage
    python backup_data.py --local-only    # skip the Storage upload
    python backup_data.py --keep 30       # also delete Storage backups older than the 30 most recent

One-time setup for the Storage upload to work:
    1. In the Supabase dashboard: Storage > Create a new bucket named "backups" (private, not public).
    2. Nothing else needed — the backend already uses the service_role key, which
       can read/write any bucket regardless of its access policies.

Restoring: this is a plain JSON export, not a ready-made restore script (real
restores need care around foreign key order). If you ever need to restore,
download the file from Storage (or use a local copy), then re-insert table by
table in this order: companies, profiles, suppliers, customers, powders,
powder_batches, jobs, powder_consumption_lots, expenses, assets — so foreign
keys resolve correctly.

Scheduling this on Render:
    Render's free/starter plans don't include native Cron Jobs on every plan,
    so the two supported options are:

    A) Render Cron Job (if available on your plan):
       - New > Cron Job, same repo, root directory `backend`.
       - Build command:   pip install -r requirements.txt
       - Command:         python backup_data.py
       - Schedule:        0 21 * * *   (this is 21:00 UTC = 2:30 AM IST — adjust for your timezone)
       - Add the same SUPABASE_URL / SUPABASE_SERVICE_KEY env vars as the main backend service.

    B) No Cron Jobs on your plan — use a free external scheduler instead:
       - Add a tiny trigger endpoint (not included here to avoid an unauthenticated
         backup endpoint sitting on the internet) or run this from your own machine
         via cron/Task Scheduler pointed at this script.
       - Simplest zero-infra option: GitHub Actions "schedule" trigger in this repo,
         since it already has its own free scheduler and secrets storage — ask if
         you'd like that workflow file added.
"""
import argparse
import json
import os
from datetime import datetime
from app.database import supabase

TABLES = [
    "companies",
    "profiles",
    "suppliers",
    "customers",
    "powders",
    "powder_batches",
    "jobs",
    "job_payments",
    "powder_consumption_lots",
    "expenses",
    "assets",
    "activity_log",
]

BUCKET = "backups"


def build_dump() -> dict:
    dump = {}
    for table in TABLES:
        try:
            rows = supabase.table(table).select("*").execute().data
            dump[table] = rows
            print(f"  {table}: {len(rows)} rows")
        except Exception as e:
            print(f"  {table}: FAILED ({e})")
            dump[table] = {"error": str(e)}
    return dump


def upload_to_storage(filename: str, payload: bytes) -> None:
    try:
        supabase.storage.from_(BUCKET).upload(
            filename,
            payload,
            {"content-type": "application/json"},
        )
        print(f"Uploaded to Storage bucket '{BUCKET}' as {filename}")
    except Exception as e:
        print(f"WARNING: Storage upload failed ({e}). Local file (if written) is still available.")


def prune_old_backups(keep: int) -> None:
    try:
        files = supabase.storage.from_(BUCKET).list()
        backups = sorted(
            (f for f in files if f["name"].startswith("backup_")),
            key=lambda f: f["name"],
            reverse=True,
        )
        to_delete = [f["name"] for f in backups[keep:]]
        if to_delete:
            supabase.storage.from_(BUCKET).remove(to_delete)
            print(f"Removed {len(to_delete)} old backup(s) from Storage, kept the {keep} most recent.")
    except Exception as e:
        print(f"WARNING: could not prune old backups ({e})")


def run_backup(local_only: bool = False, keep: int | None = None) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    filename = f"backup_{timestamp}.json"

    print("Backing up all tables...")
    dump = build_dump()
    payload = json.dumps(dump, indent=2, default=str).encode("utf-8")

    os.makedirs("backups", exist_ok=True)
    local_path = os.path.join("backups", filename)
    with open(local_path, "wb") as f:
        f.write(payload)
    print(f"\nLocal copy written to {local_path}")

    if not local_only:
        upload_to_storage(filename, payload)

    if keep:
        prune_old_backups(keep)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Back up all tables to a JSON file, optionally uploading to Supabase Storage.")
    parser.add_argument("--local-only", action="store_true", help="Skip the Supabase Storage upload; only write the local file.")
    parser.add_argument("--keep", type=int, default=None, help="Delete older Storage backups, keeping only this many most recent.")
    args = parser.parse_args()

    run_backup(local_only=args.local_only, keep=args.keep)