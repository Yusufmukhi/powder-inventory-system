-- ============================================================
-- Migration v9 — Username
-- Run this in the Supabase SQL Editor after migration_v8.
--
-- Adds a human-friendly "username" to each account, separate from their
-- login email, and stores it on every future activity log entry so the
-- Activity Log can show "Ravi" instead of "ravi@example.com".
-- ============================================================

-- ---------- 1. Add username to profiles ----------
alter table profiles add column if not exists username text;

-- Give existing accounts a starting username (the part of their email
-- before the @) so the column is never blank for people created before
-- this migration. Owners can rename these any time from Manage Users.
update profiles
set username = split_part(email, '@', 1)
where username is null;

-- One username per company (two different companies can each have their
-- own "Ravi" — that's fine — but the same company can't have two).
-- Super admins have company_id = null, so they're exempt from this and
-- just need a globally-unique username among other super admins.
create unique index if not exists idx_profiles_username_per_company
    on profiles (company_id, username)
    where company_id is not null;

create unique index if not exists idx_profiles_username_super_admin
    on profiles (username)
    where company_id is null;

-- ---------- 2. Add actor_username to activity_log ----------
alter table activity_log add column if not exists actor_username text;

-- Backfill old rows as best as we can from the profile that made them.
update activity_log a
set actor_username = p.username
from profiles p
where a.actor_id = p.id
  and a.actor_username is null;
