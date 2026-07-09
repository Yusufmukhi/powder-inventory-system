-- ============================================================
-- Migration v7 — Audit trail (activity_log)
-- Run this after migration_v6_multi_tenant.sql.
--
-- What this adds:
--   - An append-only `activity_log` table: every sensitive action (user
--     created/removed, password reset, job approved/edited, payment changed,
--     expense/asset deleted, company created/updated/suspended) is recorded
--     with who did it, when, and what changed.
--   - Owners can see their own company's log (Company Settings > Activity
--     Log). Nobody can edit or delete rows through the API — only insert.
-- ============================================================

create table if not exists activity_log (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references companies(id),   -- null for super_admin-level actions (e.g. creating a company)
    actor_id uuid not null,
    actor_email text not null,
    actor_role text not null,
    action text not null,                       -- e.g. 'user.created', 'job.approved'
    entity_type text not null,                  -- e.g. 'user', 'job', 'expense', 'company'
    entity_id text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table activity_log enable row level security;
-- No policies on purpose, same pattern as `companies` — only the backend's
-- service_role key can write to or read this table. The API only ever
-- exposes read-only, company-scoped access via GET /auth/activity-log.

create index if not exists idx_activity_log_company_created
    on activity_log(company_id, created_at desc);
