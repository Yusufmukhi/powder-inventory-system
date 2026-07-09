-- ============================================================
-- Migration v6 — True multi-tenancy ("Companies")
-- Run this after migration_v5_company_settings.sql.
--
-- What this changes:
--   - Introduces a `companies` table (many rows now, not one singleton).
--   - Every user (`profiles`) belongs to exactly one company (company_id),
--     EXCEPT a new 'super_admin' role, which belongs to none.
--   - Every business table gets a company_id column, so each company's data
--     is completely walled off from every other company's data.
--   - Your existing data (everything created so far) is migrated into ONE
--     company automatically, so nothing is lost.
--   - Only a super_admin can create a new company (and its first Owner).
--     Owners can no longer accidentally create users into "the wrong place"
--     — they can only ever create users inside their OWN company.
-- ============================================================

-- ---------- 1. COMPANIES ----------
create table if not exists companies (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    subscription_status text not null default 'active'
        check (subscription_status in ('active', 'suspended')),
    max_owners integer not null default 2,
    max_staff integer not null default 3,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table companies enable row level security;
-- No policies on purpose — only the backend's service_role key can touch this table.

-- Migrate the single old company_settings row (if any) into companies, so your
-- existing company keeps its name / seat limits / subscription status.
insert into companies (name, subscription_status, max_owners, max_staff)
select company_name, subscription_status, max_owners, max_staff
from company_settings
where not exists (select 1 from companies);

-- Fallback: if company_settings didn't exist for some reason, still make sure
-- there's at least one company to attach existing data/users to.
insert into companies (name)
select 'My Company'
where not exists (select 1 from companies);

-- ---------- 2. PROFILES: company_id + super_admin role ----------
alter table profiles add column if not exists company_id uuid references companies(id);

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
    check (role in ('super_admin', 'owner', 'shop_floor'));

-- Every existing user (all of whom were really in "the one company" already)
-- gets attached to that migrated company.
update profiles
set company_id = (select id from companies order by created_at limit 1)
where company_id is null;

-- ---------- 3. BUSINESS TABLES: company_id ----------
alter table suppliers add column if not exists company_id uuid references companies(id);
alter table customers add column if not exists company_id uuid references companies(id);
alter table powders add column if not exists company_id uuid references companies(id);
alter table powder_batches add column if not exists company_id uuid references companies(id);
alter table jobs add column if not exists company_id uuid references companies(id);
alter table expenses add column if not exists company_id uuid references companies(id);
alter table assets add column if not exists company_id uuid references companies(id);
alter table powder_consumption_lots add column if not exists company_id uuid references companies(id);

update suppliers set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update customers set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update powders set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update powder_batches set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update jobs set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update expenses set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update assets set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update powder_consumption_lots set company_id = (select id from companies order by created_at limit 1) where company_id is null;

alter table suppliers alter column company_id set not null;
alter table customers alter column company_id set not null;
alter table powders alter column company_id set not null;
alter table powder_batches alter column company_id set not null;
alter table jobs alter column company_id set not null;
alter table expenses alter column company_id set not null;
alter table assets alter column company_id set not null;
-- powder_consumption_lots left nullable — it's always reachable via batch_id/job_id anyway.

create index if not exists idx_suppliers_company on suppliers(company_id);
create index if not exists idx_customers_company on customers(company_id);
create index if not exists idx_powders_company on powders(company_id);
create index if not exists idx_powder_batches_company on powder_batches(company_id);
create index if not exists idx_jobs_company on jobs(company_id);
create index if not exists idx_expenses_company on expenses(company_id);
create index if not exists idx_assets_company on assets(company_id);
create index if not exists idx_profiles_company on profiles(company_id);

-- ---------- 4. Retire the old singleton table ----------
-- Everything it did (name, subscription_status, seat limits) now lives per-row
-- in `companies`. Safe to drop now that its one row has been copied above.
drop table if exists company_settings cascade;

-- ---------- 5. Make yourself the super_admin ----------
-- Run this once, with your own email, so you can log in and create companies:
--
--   update profiles set role = 'super_admin', company_id = null
--   where email = 'you@example.com';
--
-- After that, log out and back in. You'll see a "Companies" screen instead of
-- the normal business app — that's where you create new companies and assign
-- each one's first Owner.
