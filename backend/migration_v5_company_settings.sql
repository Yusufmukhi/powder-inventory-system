-- ============================================================
-- Migration v5 — Invite-only accounts, seat limits, subscription switch
-- Run this after migration_v4_auth_rls.sql.
-- ============================================================

-- ---------- COMPANY SETTINGS ----------
-- One row per deployment. This is how you (as the person who set this up for
-- a client) control whether their copy of the app works at all, and how many
-- Owner/Staff accounts they're allowed to create.
create table if not exists company_settings (
    id uuid primary key default gen_random_uuid(),
    company_name text not null default 'My Company',
    subscription_status text not null default 'active'
        check (subscription_status in ('active', 'suspended')),
    max_owners integer not null default 2,
    max_staff integer not null default 3,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Seed exactly one settings row (the app always reads/updates this single row).
insert into company_settings (company_name, subscription_status, max_owners, max_staff)
select 'My Company', 'active', 2, 3
where not exists (select 1 from company_settings);

alter table company_settings enable row level security;
-- No policies added on purpose — only your backend's service_role key can read/write this,
-- so a client can't flip their own subscription_status back to 'active' by editing the DB directly.

-- ---------- To suspend a client later ----------
-- update company_settings set subscription_status = 'suspended';
-- (every login and every API call for that deployment stops working immediately)
--
-- To resume:
-- update company_settings set subscription_status = 'active';
--
-- To change seat limits:
-- update company_settings set max_owners = 2, max_staff = 5;
