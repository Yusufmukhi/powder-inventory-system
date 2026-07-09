-- ============================================================
-- Migration v3 — run this if you already applied supabase_schema.sql
-- (schema v2) and don't want to drop your existing data.
-- Adds: payment_method on jobs, asset_type + nullable useful_life_years
-- on assets (for land / non-depreciable capital purchases).
-- ============================================================

alter table jobs
    add column if not exists payment_method text
        check (payment_method in ('cash', 'cheque', 'upi', 'bank_transfer', 'card') or payment_method is null);

alter table assets
    add column if not exists asset_type text not null default 'depreciable'
        check (asset_type in ('depreciable', 'land'));

alter table assets
    alter column useful_life_years drop not null;

alter table assets
    alter column useful_life_years drop default;
