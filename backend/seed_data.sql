-- ============================================================
-- SEED DATA — run this AFTER supabase_schema.sql
-- Gives you enough data to see every screen working:
-- suppliers, customers, powders with multiple batches (FIFO),
-- jobs in every status, expenses, and depreciation assets.
-- ============================================================

-- Every business table now requires a company_id (multi-tenant, migration_v6).
-- Temporarily default it to your first company for this script, then drop
-- the default again at the end.
do $$
declare
  v_company uuid;
begin
  select id into v_company from companies order by created_at limit 1;
  if v_company is null then
    raise exception 'No company found. Run migration_v6_multi_tenant.sql and create at least one company first.';
  end if;

  execute format('alter table suppliers alter column company_id set default %L', v_company);
  execute format('alter table customers alter column company_id set default %L', v_company);
  execute format('alter table powders alter column company_id set default %L', v_company);
  execute format('alter table powder_batches alter column company_id set default %L', v_company);
  execute format('alter table jobs alter column company_id set default %L', v_company);
  execute format('alter table expenses alter column company_id set default %L', v_company);
  execute format('alter table assets alter column company_id set default %L', v_company);
end $$;

-- ---------- SUPPLIERS ----------
insert into suppliers (id, name, contact_number) values
('a1111111-1111-1111-1111-111111111111', 'Shree Powder Coatings', '9820011111'),
('a2222222-2222-2222-2222-222222222222', 'Berger Powder Suppliers', '9820022222');

-- ---------- CUSTOMERS ----------
insert into customers (id, name, contact_number, address) values
('b1111111-1111-1111-1111-111111111111', 'Myriad Storage System LLP', '9820033333', 'Bhiwandi, Mumbai'),
('b2222222-2222-2222-2222-222222222222', 'ABC Steel Furniture', '9820044444', 'Vasai East'),
('b3333333-3333-3333-3333-333333333333', 'Walk-in Customer', null, null);

-- ---------- POWDERS ----------
insert into powders (id, shade_name, default_supplier_id, reorder_threshold_kg) values
('c1111111-1111-1111-1111-111111111111', 'Jet Black', 'a1111111-1111-1111-1111-111111111111', 10),
('c2222222-2222-2222-2222-222222222222', 'Signal Red', 'a2222222-2222-2222-2222-222222222222', 10),
('c3333333-3333-3333-3333-333333333333', 'Silver Grey', 'a1111111-1111-1111-1111-111111111111', 5);

-- ---------- POWDER BATCHES (two batches for Jet Black on purpose, to show FIFO) ----------
insert into powder_batches (id, powder_id, supplier_id, qty_kg, remaining_qty_kg, price_per_kg, purchase_date, notes) values
('d1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 50, 35, 260, '2026-05-01', 'First batch of the season'),
('d1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 30, 30, 275, '2026-06-15', 'Price went up slightly'),
('d2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 40, 40, 310, '2026-05-10', null),
('d3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 20, 12, 290, '2026-06-01', null);

-- ---------- JOBS ----------

-- Job 1: freshly received, nothing done yet -> Edit + Approve should both show
insert into jobs (id, job_number, customer_id, product_name, qty_received, powder_id, date_received, date_promised, status) values
('e1111111-1111-1111-1111-111111111111', 'PC-2026-0001', 'b1111111-1111-1111-1111-111111111111', 'Mobile Compactor Rack', 10, 'c1111111-1111-1111-1111-111111111111', '2026-06-20', '2026-06-28', 'received');

-- Job 2: in process -> Edit + Approve should both show
insert into jobs (id, job_number, customer_id, product_name, qty_received, powder_id, date_received, date_promised, status) values
('e2222222-2222-2222-2222-222222222222', 'PC-2026-0002', 'b2222222-2222-2222-2222-222222222222', 'Steel Almirah', 5, 'c2222222-2222-2222-2222-222222222222', '2026-06-25', '2026-07-02', 'in_process');

-- Job 3: approved -> no Edit/Approve, "Mark Delivered" should show. Consumed 8kg of Silver Grey.
insert into jobs (id, job_number, customer_id, product_name, qty_received, powder_id, date_received, date_promised, date_completed, status, powder_consumed_kg, powder_cost, price_charged, payment_status) values
('e3333333-3333-3333-3333-333333333333', 'PC-2026-0003', 'b3333333-3333-3333-3333-333333333333', 'Chairs (set of 20)', 20, 'c3333333-3333-3333-3333-333333333333', '2026-06-01', '2026-06-10', '2026-06-09', 'approved', 8, 2320, 6500, 'advance');

insert into powder_consumption_lots (job_id, batch_id, qty_kg, price_per_kg) values
('e3333333-3333-3333-3333-333333333333', 'd3333333-3333-3333-3333-333333333333', 8, 290);

-- Job 4: delivered -> fully closed. Consumed 15kg of Jet Black, drawn from the OLDER batch first (FIFO).
insert into jobs (id, job_number, customer_id, product_name, qty_received, powder_id, date_received, date_promised, date_completed, status, powder_consumed_kg, powder_cost, price_charged, payment_status) values
('e4444444-4444-4444-4444-444444444444', 'PC-2026-0004', 'b1111111-1111-1111-1111-111111111111', 'Rack Batch 2', 8, 'c1111111-1111-1111-1111-111111111111', '2026-06-20', '2026-06-30', '2026-07-02', 'delivered', 15, 3900, 9000, 'paid');

insert into powder_consumption_lots (job_id, batch_id, qty_kg, price_per_kg) values
('e4444444-4444-4444-4444-444444444444', 'd1111111-1111-1111-1111-111111111111', 15, 260);

-- ---------- EXPENSES ----------
insert into expenses (expense_date, category, description, amount) values
('2026-06-05', 'wages', 'Worker salaries - June', 15000),
('2026-06-10', 'electricity', 'MSEB bill - June', 4200),
('2026-06-18', 'other', 'Diesel for generator', 1200),
('2026-07-03', 'wages', 'Worker salaries - July (part)', 15000),
('2026-07-04', 'electricity', 'MSEB bill - July', 3900);

-- ---------- ASSETS (for depreciation) ----------
insert into assets (name, purchase_price, purchase_date, useful_life_years) values
('Office TV', 25000, '2025-01-15', 5),
('Waiting Area Chairs (set)', 8000, '2025-03-01', 4);

-- Drop the temporary defaults set above, now that every row has an explicit company_id.
alter table suppliers alter column company_id drop default;
alter table customers alter column company_id drop default;
alter table powders alter column company_id drop default;
alter table powder_batches alter column company_id drop default;
alter table jobs alter column company_id drop default;
alter table expenses alter column company_id drop default;
alter table assets alter column company_id drop default;
