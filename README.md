# Powder Coating — Inventory & Job Management (v2)

## What changed from v1
- **Powder = name + supplier only.** Cost lives on each stock batch instead, since price changes per purchase.
- **Stock is FIFO under the hood.** Every "Add Stock" entry is a batch (qty + price + supplier + date). When a job is approved and powder is consumed, the app draws from the oldest batch first automatically and calculates the real cost from whatever batches it drew from. None of this is labeled "FIFO" anywhere in the UI — it just works.
- **Suppliers** are their own list with a dropdown + "add new" inline, used both when adding a powder and when adding stock.
- **Click a powder row** to open a popup with everything added and used for that shade, with a date range toggle (1 week / 1 month / 3 months / all time) — defaults to 1 month.
- **Jobs are editable only up to approval.** Once approved, Edit and Approve both disappear; a "Mark Delivered" button takes over.
- **No per-job profit.** Approve only asks for completion date, powder consumed (kg), and the price you worked for. That's it.
- **Expenses page (new):** log wages / electricity / other running costs by date, and depreciable assets (TV, chairs, etc. — enter price + useful life, monthly depreciation is calculated automatically). Pick a month and see Revenue, Powder Cost, Expenses, Depreciation, and Net Profit for that month in one place.

## What's new: login, roles, security, backups (v4)
- **Login is now required.** Nobody can open the app without an account. First-time users can sign up right from the Login page.
- **Two roles: Owner and Shop Floor.** Every new signup starts as Shop Floor. Shop Floor can do intake, edit (until approved), add stock, manage customers/suppliers. Only Owner can Approve jobs and see the Expenses page — the Expenses nav link doesn't even show for Shop Floor, and Approve is blocked both in the UI and on the server if someone tries to call it directly.
- **Row Level Security turned on** for every table. Your backend (using the service_role key) is unaffected, but if the project's public/anon key were ever exposed, none of your business data would be readable or writable through it.
- **FIFO stock consumption is now atomic.** Moved into a single Postgres function with row locking, so two jobs approved for the same powder shade at nearly the same moment can no longer double-spend the same stock.
- **Backup script** (`backend/backup_data.py`) dumps every table to a timestamped JSON file — useful since free-tier Supabase doesn't include point-in-time recovery.

## Stack
- **Backend:** FastAPI + Supabase (Postgres)
- **Frontend:** React + TypeScript + Vite + Tailwind

## Flow

1. **New Powder** — just a name and a supplier.
2. **Add Stock** — pick the powder, pick/add a supplier, enter price/kg, qty, and purchase date. This creates a batch.
3. **New Job (intake)** — customer, product, qty, color/powder, date received, date needed by.
4. **Edit** — works only while the job is `received` or `in_process`.
5. **Approve** — completion date, powder consumed (kg), price you worked for. The app deducts stock (oldest batch first) and records the real cost internally for the Expenses report. Job moves to `approved`; edit/approve are gone from that point.
6. **Mark Delivered** — final step once approved.
7. **Payment** — click the payment badge on a job to cycle unpaid → advance → paid.
8. **Expenses** — log monthly wages/electricity/other, add depreciable assets, and check the monthly P&L summary.

## What's new: invite-only accounts, seat limits, subscription switch (v5)
- **No more self-signup.** The Login page is login-only now. The very first account has to be created directly in Supabase (see Setup below); every account after that is created by an Owner from the new **Manage Users** page.
- **Manage Users page (Owner-only):** create a new account (email + temporary password + role), see everyone with access, and remove an account. Also shows seat usage, e.g. "Owners: 1/2, Staff: 2/3".
- **Seat limits.** Set in the `company_settings` table (`max_owners`, `max_staff` — defaults 2 and 3). Creating a user beyond the limit is blocked with a clear message, both in the UI (the option is disabled) and on the server (so it can't be bypassed by calling the API directly).
- **A subscription on/off switch, per deployment.** `company_settings.subscription_status` is either `active` or `suspended`. The moment it's set to `suspended`, every login and every API call stops working immediately (a 402 response), and anyone already logged in sees a plain "Access Suspended" screen instead of the app. This is meant for exactly your scenario: if you set this up for a client and they haven't paid, you flip one field in Supabase and their whole copy of the app goes dark — no code changes needed.
  ```sql
  update company_settings set subscription_status = 'suspended';  -- lock them out
  update company_settings set subscription_status = 'active';     -- restore access
  ```

## What's new: real multi-tenancy — Companies (v6)
- **Multiple companies, one deployment.** Previously every signup landed in the same single bucket of data. Now there's an actual `companies` table — you can run many separate client companies out of one deployment, each with its own users, jobs, powders, customers, expenses — fully walled off from every other company's data.
- **A new role: Super Admin (you).** Only a super_admin can create a new company, and only a super_admin decides who that company's first Owner is. Owners can never create a company themselves, and an Owner creating a new user can only ever add them to their *own* company — no more "which bucket did this user land in?" confusion.
- **New "Companies" screen (super_admin only).** Replaces the normal business nav entirely for this role. Create a company (name + seat limits + first Owner's email/password) in one step, see every company's owner/staff seat usage, and suspend/activate any company's subscription with one click.
- **"Company Settings" tab (Owner-only).** The old "Manage Users" page now lives inside a Company Settings tab in the sidebar, alongside a Company Info tab — exactly where an Owner would expect to manage their own team.
- **Migrating existing data:** run `backend/migration_v6_multi_tenant.sql` after `migration_v5_company_settings.sql`. It automatically creates one company from your existing `company_settings` row and attaches all your existing users/jobs/powders/etc. to it — nothing is lost. Full details and the exact SQL to promote yourself to super_admin are in the comments at the top of that file.

## What's new: audit trail, password reset, scheduled backups (v7)
- **Activity Log (Owner-only, Company Settings → Activity Log).** Every sensitive action is now recorded: accounts created/removed, password resets, job edits/approvals/payment updates, expense/asset deletions, and (for super admins) company creation and suspend/reactivate. Each entry shows who did it, when, and the relevant details. It's append-only through the API — nothing can be edited or deleted from the app, only inserted.
- **Password reset, two ways:**
  - **Owner resets someone else's password** — from Company Settings → Manage Users, click **Reset Password** next to any account and set a new temporary one. No email sending involved, same as when the account was first created — just share the new password with them directly.
  - **Anyone changes their own password** — click **Change Password** at the bottom of the sidebar (available to every role). It asks for your current password first (verified against Supabase, not just your session token) before letting you set a new one.
- **Scheduled backups.** `backup_data.py` now also uploads its JSON snapshot to a Supabase Storage bucket (not just a local file), so it survives even when run from a fresh, ephemeral container (e.g. a Render Cron Job) rather than your own laptop. See the **Backups** section below for setup and scheduling.
- **Migrating existing data:** run `backend/migration_v7_audit_log.sql` after `migration_v6_multi_tenant.sql`. It only adds a new `activity_log` table — nothing existing is touched.



### 1. Database (Supabase)
1. Create a Supabase project.
2. Run `backend/supabase_schema.sql` in the SQL editor. This creates suppliers, powders, powder_batches (FIFO lots), jobs, powder_consumption_lots, expenses, and assets.
   - **Already have the schema applied from before?** Don't drop your tables — just run `backend/migration_v3.sql`, then `backend/migration_v4_auth_rls.sql`, then `backend/migration_v5_company_settings.sql`, then `backend/migration_v6_multi_tenant.sql`, then `backend/migration_v7_audit_log.sql`, in that order.
   - `migration_v4_auth_rls.sql` adds the `profiles` table (role per user), turns on Row Level Security, and replaces the powder-consumption logic with an atomic Postgres function.
   - `migration_v5_company_settings.sql` adds the `company_settings` table (one row) that controls seat limits and the subscription on/off switch.
   - `migration_v6_multi_tenant.sql` replaces `company_settings` with a proper `companies` table (many rows) and adds `company_id` to every table, so this one deployment can run multiple fully-separated client companies. See "What's new: real multi-tenancy" above.
   - `migration_v7_audit_log.sql` adds the `activity_log` table used by the Activity Log screen. See "What's new: audit trail, password reset, scheduled backups" above.
3. Copy your Project URL and **service_role** key (Settings → API) — for the backend.
4. Also copy the **anon/public** key (same page) — needed for the frontend's login screen. (Earlier versions of this README also asked for a JWT Secret for the backend — that's no longer needed: the backend now verifies logins by asking Supabase directly, which works regardless of how your project signs tokens.)
5. In Authentication → Providers, make sure Email is enabled (it is by default). For a small in-house tool, you can also turn off "Confirm email" under Authentication → Settings so new signups can log in immediately without clicking a verification email.

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate     # Windows Git Bash
# source venv/bin/activate       # Mac/Linux
pip install -r requirements.txt
cp .env.example .env             # fill in SUPABASE_URL and SUPABASE_SERVICE_KEY
uvicorn app.main:app --reload --port 8000
```
API docs at `http://localhost:8000/docs`.

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env             # VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev
```
Open `http://localhost:5173`.

### 4. First login (no self-signup — create the first account manually)
1. In Supabase dashboard → **Authentication → Users**, click **Add User** (or **Invite**), enter your own email + a password, and make sure "Auto Confirm User" is checked so you don't need email delivery set up.
2. In the SQL editor, make yourself the **super admin** (not an Owner — the super admin is you, the person running this deployment, and belongs to no single company):
   ```sql
   update profiles set role = 'super_admin', company_id = null where email = 'youremail@example.com';
   ```
3. Log in on the app with that email/password. You'll see a **Companies** screen instead of the normal business app — that's expected for a super admin.
4. Click **Create Company**: give it a name, seat limits, and the email/password for its first Owner. That Owner can now log in and see the normal app (Dashboard, Jobs, Powders, Customers, and for them specifically, Expenses + Company Settings).
5. From there, that Owner creates every other account for their company (more Owners, or Shop Floor staff) from **Company Settings → Manage Users** — not through Supabase directly. You, as super admin, create companies — you don't need to touch individual company's users day to day.

## Suggested first steps
1. Add a supplier while adding your first powder (e.g. "Jet Black" + supplier).
2. Add stock for it — price/kg + qty + date.
3. Add a customer, then create a job against that powder.
4. Approve the job — watch stock drop automatically.
5. Go to Expenses, log this month's wages/electricity, add an asset or two, and check the monthly summary.

## What's new in this round
- **Jobs page**: quick filter chips (All / Pending / Approved / Delivered / Unpaid / Late), a customer dropdown filter, and a "Group by client" toggle that clusters the table under each customer's name.
- **Payment**: clicking the payment badge now opens a small dialog — pick Unpaid/Advance/Paid, and (if not Unpaid) how it was paid: Cash, Cheque, UPI/QR, Bank Transfer, or Card. Shown on the badge as e.g. "paid · UPI/QR".
- **Powder stock popup**: now has a fixed header with a properly scrolling list underneath (was capped at showing ~3 rows before), plus a visible scrollbar and a row count.
- **Expenses page**:
  - **Land / large one-time purchases** now have their own "Land / Capital" asset type — separate from depreciable assets (furniture, equipment). These add to your asset base but are correctly *excluded* from the monthly Net Profit calculation (a land purchase isn't a monthly expense — it's a balance-sheet item), matching how a real P&L statement works.
  - **Financial Year view** — toggle between Monthly and Financial Year (Apr–Mar), with a dropdown for the last few FYs.
  - **Formal Profit & Loss statement** — the summary is now laid out like an actual accounting statement (Revenue → less COGS → Gross Profit → less Operating Expenses → less Depreciation → Net Profit), with a separate "Capital Purchases" section below it.
  - **Excel export** — a button exports the current period (month or FY) as a `.xlsx` with three sheets: P&L Statement, Expenses detail, and Fixed Asset Register.

## Testing with sample data

**Fresh 2-year dataset** (recommended for checking filters, grouping, Financial Year reports, and Excel export):
Run `backend/seed_data_2years.sql` in the Supabase SQL Editor. **Requires at least one company to already exist** (create one from the Companies screen as super admin first, or via `migration_v6_multi_tenant.sql`) — the script attaches all seeded data to your first company automatically. It generates ~96 jobs spread across the last 24 months (in every status — received/in_process/approved/delivered, and every payment state including cash/cheque/UPI/bank transfer), monthly restocked powder batches with FIFO-consistent stock levels, 2 years of wages/electricity/other expenses, 3 depreciable assets, and one big Land purchase (₹25,00,000) — enough to see the Monthly vs Financial Year toggle, the "Group by client" view, and every filter chip actually doing something.

Only run it on empty tables (it doesn't check for existing data, so re-running it will duplicate everything).

**Wiping all data** (to start clean, e.g. before re-seeding or going live with real data):
Run `backend/wipe_all_data.sql` in the Supabase SQL Editor. It empties every table (`suppliers`, `customers`, `powders`, `powder_batches`, `jobs`, `powder_consumption_lots`, `expenses`, `assets`, `activity_log`) but keeps the schema/tables themselves intact — nothing needs to be re-run in your app or `.env` afterward. It resets the auto-increment sequences too, so if you re-seed after wiping, numbering starts fresh.

```sql
-- backend/wipe_all_data.sql, paste directly into Supabase SQL Editor
truncate table
  powder_consumption_lots, powder_batches, jobs, expenses, assets,
  powders, customers, suppliers, activity_log
restart identity cascade;
```

If you only want to clear specific tables instead of everything, `truncate table jobs restart identity cascade;` (swap in whichever table name) works the same way — `cascade` makes sure any dependent rows (like `powder_consumption_lots` referencing a deleted job) go with it instead of blocking the truncate.

## Backups
`backup_data.py` (inside `backend/`) writes a timestamped JSON snapshot of every table, and — since v7 — also uploads that same file to a Supabase Storage bucket so the backup survives even if it's run from a throwaway container rather than your own machine.

**One-time setup:**
1. In the Supabase dashboard: **Storage → Create a new bucket** named `backups` (private is fine — the backend only ever uses its service_role key, which can read/write it regardless).
2. That's it — no other config needed.

**Run it manually any time:**
```bash
cd backend
python backup_data.py              # writes backend/backups/*.json AND uploads to Storage
python backup_data.py --local-only # skip the Storage upload
python backup_data.py --keep 30    # also prune older Storage backups, keeping the 30 most recent
```

**Running it on a schedule (recommended — this is what "scheduled backups" means in practice):**
Since this backend is deployed on Render, the straightforward option is a **Render Cron Job**:
1. Render dashboard → **New → Cron Job**, same repo, root directory `backend`.
2. Build command: `pip install -r requirements.txt`
3. Command: `python backup_data.py --keep 30`
4. Schedule: e.g. `0 21 * * *` (21:00 UTC = 2:30 AM IST — adjust for whichever timezone you want it to run in)
5. Add the same `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` environment variables you already use on the main backend service.

If your Render plan doesn't include Cron Jobs, the free fallback is a GitHub Actions scheduled workflow in this repo (it has its own scheduler and secret storage built in) — ask if you'd like that workflow file added.

**Restoring:** this is a plain JSON export, not a one-click restore. Download the file from the `backups` bucket (or use a local copy), then re-insert table by table in this order so foreign keys resolve correctly: `companies`, `profiles`, `suppliers`, `customers`, `powders`, `powder_batches`, `jobs`, `powder_consumption_lots`, `expenses`, `assets`, `activity_log`.

## Notes / possible next steps
- **Job photos**, **invoice/PDF export** — not built yet, can be added.
- **Supplier payables** — you track what powder you bought, not yet what you owe each supplier.
- **Batch-level traceability** — `powder_consumption_lots` already stores exactly which batch(es) a job drew from and at what price, in case you want a detailed cost audit later.
- ~~No audit trail~~ / ~~no password reset flow~~ / ~~backups are manual~~ — addressed in v7 (Activity Log, password reset/change, scheduled Storage-backed backups). See "What's new: audit trail, password reset, scheduled backups" above.
 
 