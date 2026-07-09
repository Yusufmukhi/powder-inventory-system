"""
Restore script — brings back data from a backup JSON produced by
backup_data.py, either a local file or the most recent one in the
Supabase Storage 'backups' bucket.

WHEN YOU'D USE THIS: something went wrong (accidental delete, bad
migration, wiped a table by mistake) and you need last night's data back.

WHAT IT DOES: for each table, upserts every row from the backup back into
Supabase, in an order that respects foreign keys (customers before jobs,
powders before powder_batches, etc.). Upsert (not insert) means it's safe
to run more than once — existing rows with matching ids just get
overwritten with the backup's values, nothing duplicates.

WHAT IT WON'T FIX: `profiles` rows reference `auth.users`, which lives in
Supabase's own Auth system and is NOT part of this backup at all. If a
user's login was deleted from Auth, their profile row cannot be restored
until you recreate that login (e.g. via ManageUsers / SuperAdminCompanies
in the app) — this script will report that failure per-row rather than
silently skipping it or crashing the whole restore.

Usage:
    cd backend

    # Restore from the most recent backup in Supabase Storage
    python restore_data.py --latest

    # Restore from a specific local file
    python restore_data.py --file backups/backup_2026-07-09_0230.json

    # See what WOULD happen without writing anything
    python restore_data.py --latest --dry-run

    # Restore only specific tables (e.g. you only lost expenses)
    python restore_data.py --latest --tables expenses assets

Requires the same SUPABASE_URL / SUPABASE_SERVICE_KEY env vars as the
main backend (the service_role key bypasses RLS, which is required here).
"""
import argparse
import json
import sys
from app.database import supabase

# Parent tables first, dependents after — mirrors the foreign keys in
# supabase_schema.sql and the migration files. A table not in this list
# (i.e. one added to a backup after this script was last updated) is
# restored last, in whatever order it appears.
RESTORE_ORDER = [
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


def load_dump(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def fetch_latest_from_storage() -> dict:
    bucket = "backups"
    files = supabase.storage.from_(bucket).list()
    backups = sorted(
        (f for f in files if f["name"].startswith("backup_")),
        key=lambda f: f["name"],
        reverse=True,
    )
    if not backups:
        print("No backups found in Storage bucket 'backups'.")
        sys.exit(1)
    latest = backups[0]["name"]
    print(f"Using latest backup from Storage: {latest}")
    raw = supabase.storage.from_(bucket).download(latest)
    return json.loads(raw)


def restore_table(table: str, rows: list, dry_run: bool) -> tuple[int, int]:
    if not rows:
        print(f"  {table}: nothing to restore (0 rows in backup)")
        return 0, 0
    if isinstance(rows, dict) and "error" in rows:
        print(f"  {table}: SKIPPED — this table failed during the original backup ({rows['error']})")
        return 0, 0

    if dry_run:
        print(f"  {table}: would restore {len(rows)} row(s) [dry run, nothing written]")
        return len(rows), 0

    ok, failed = 0, 0
    # Upsert in a single batch call where possible; fall back to row-by-row
    # so one bad row (e.g. a profile whose auth user no longer exists)
    # doesn't block the rest of the table.
    try:
        supabase.table(table).upsert(rows).execute()
        ok = len(rows)
    except Exception:
        for row in rows:
            try:
                supabase.table(table).upsert(row).execute()
                ok += 1
            except Exception as e:
                failed += 1
                row_id = row.get("id", "?") if isinstance(row, dict) else "?"
                print(f"    FAILED row id={row_id}: {e}")
    print(f"  {table}: restored {ok} row(s)" + (f", {failed} failed" if failed else ""))
    return ok, failed


def run_restore(dump: dict, only_tables: list[str] | None, dry_run: bool) -> None:
    order = [t for t in RESTORE_ORDER if t in dump]
    order += [t for t in dump if t not in RESTORE_ORDER]  # any unexpected extras, restored last

    if only_tables:
        order = [t for t in order if t in only_tables]

    print(f"\n{'DRY RUN — ' if dry_run else ''}Restoring {len(order)} table(s) in dependency order...\n")

    total_ok, total_failed = 0, 0
    for table in order:
        ok, failed = restore_table(table, dump.get(table, []), dry_run)
        total_ok += ok
        total_failed += failed

    print(f"\nDone. {total_ok} row(s) {'would be ' if dry_run else ''}restored, {total_failed} failed.")
    if total_failed:
        print("Rows that failed (commonly: a profile whose auth.users login no longer exists,")
        print("or a foreign key pointing at a row that itself failed to restore) need a manual look.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Restore data from a backup_data.py JSON dump.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--file", help="Path to a local backup JSON file.")
    source.add_argument("--latest", action="store_true", help="Fetch the most recent backup from Supabase Storage.")
    parser.add_argument("--tables", nargs="+", help="Restore only these tables (space-separated).")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be restored without writing anything.")
    args = parser.parse_args()

    dump = load_dump(args.file) if args.file else fetch_latest_from_storage()

    if not args.dry_run:
        confirm = input(
            "This will UPSERT the backup's data into your live Supabase project "
            "(existing rows with matching ids get overwritten). Type 'yes' to continue: "
        )
        if confirm.strip().lower() != "yes":
            print("Cancelled.")
            sys.exit(0)

    run_restore(dump, args.tables, args.dry_run)