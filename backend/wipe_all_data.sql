-- ============================================================
-- Wipe ALL data (keeps tables/schema intact — just empties them)
-- Run this in the Supabase SQL Editor when you want a clean slate,
-- e.g. before re-running a seed script or going live with real data.
--
-- TRUNCATE ... CASCADE handles the foreign keys between tables
-- automatically, so the order here doesn't actually matter, but
-- they're listed in a sensible order anyway.
-- ============================================================

truncate table
  powder_consumption_lots,
  powder_batches,
  jobs,
  expenses,
  assets,
  powders,
  customers,
  suppliers,
  activity_log
restart identity cascade;
