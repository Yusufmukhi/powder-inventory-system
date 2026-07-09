-- ============================================================
-- 2-year seed data (24 months, ending this month)
-- Run this AFTER supabase_schema.sql (or migration_v3.sql) on a
-- fresh/empty set of tables. It generates suppliers, customers,
-- powders + restocked batches, ~90-100 jobs spread across 24
-- months (in every status, with FIFO-consistent stock deduction),
-- monthly wages/electricity/other expenses, a few depreciable
-- assets, and one big Land purchase — enough to properly exercise
-- the Jobs filters/grouping, the monthly vs Financial Year report,
-- and the Excel export.
--
-- Safe to run only once on empty tables. Re-running will duplicate
-- data (see the "wipe" script below if you want to clear first).
-- ============================================================

-- Every business table now requires a company_id (multi-tenant, migration_v6).
-- Rather than touching every insert below, we temporarily default company_id
-- to your first company for the duration of this script, then drop the
-- default again at the end so nothing is left in a surprising state.
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

do $$
declare
  s1 uuid; s2 uuid; s3 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;
  customer_ids uuid[];
  powder_ids uuid[];
  product_names text[] := array[
    'Mobile Compactor Rack','Steel Almirah','Chairs Set','Window Frames','Gate Grill',
    'Storage Rack','Trolley Frame','Shelving Unit','Railing Section','Almirah Doors'
  ];
  month_offset int;
  month_start date;
  jobs_this_month int;
  i int;
  j int;
  cust_id uuid;
  pow_id uuid;
  qty int;
  consumed numeric;
  price_charged_val numeric;
  date_recv date;
  date_prom date;
  date_comp date;
  job_id uuid;
  jobnum text;
  seq int := 1;
  remaining_needed numeric;
  batch record;
  take numeric;
  cost numeric;
  supplier_choice uuid;
  batch_price numeric;
  new_status text;
  pay_status text;
  pay_method text;
begin
  -- ============ SUPPLIERS ============
  insert into suppliers (name, contact_number) values ('Shree Powder Coatings','9821000001') returning id into s1;
  insert into suppliers (name, contact_number) values ('Berger Powder Suppliers','9821000002') returning id into s2;
  insert into suppliers (name, contact_number) values ('National Coatings Pvt Ltd','9821000003') returning id into s3;

  -- ============ CUSTOMERS ============
  insert into customers (name, contact_number, address) values ('Myriad Storage Systems LLP','9820011111','Thane MIDC') returning id into c1;
  insert into customers (name, contact_number, address) values ('ABC Industries','9820022222','Bhiwandi') returning id into c2;
  insert into customers (name, contact_number, address) values ('Dee Blue Fabricators','9820033333','Wagle Estate, Thane') returning id into c3;
  insert into customers (name, contact_number, address) values ('Om Sai Engineering Works','9820044444','Vasai') returning id into c4;
  insert into customers (name, contact_number, address) values ('Krishna Metal Works','9820055555','Kalyan') returning id into c5;
  insert into customers (name, contact_number, address) values ('Sunrise Steel Traders','9820066666','Bhiwandi') returning id into c6;
  customer_ids := array[c1,c2,c3,c4,c5,c6];

  -- ============ POWDERS ============
  insert into powders (shade_name, default_supplier_id, reorder_threshold_kg) values ('Jet Black', s1, 10) returning id into p1;
  insert into powders (shade_name, default_supplier_id, reorder_threshold_kg) values ('Signal Red', s2, 8) returning id into p2;
  insert into powders (shade_name, default_supplier_id, reorder_threshold_kg) values ('Silver Grey', s1, 8) returning id into p3;
  insert into powders (shade_name, default_supplier_id, reorder_threshold_kg) values ('RAL 9016 White', s3, 10) returning id into p4;
  insert into powders (shade_name, default_supplier_id, reorder_threshold_kg) values ('Bronze Textured', s2, 6) returning id into p5;
  powder_ids := array[p1,p2,p3,p4,p5];

  -- ============ 24 MONTHS OF BATCHES, JOBS, EXPENSES ============
  for month_offset in reverse 23..0 loop
    month_start := (date_trunc('month', current_date) - (month_offset || ' months')::interval)::date;

    -- Restock every powder a little each month; price creeps up slightly over time
    for i in 1..array_length(powder_ids,1) loop
      pow_id := powder_ids[i];
      supplier_choice := case when i % 2 = 0 then s2 else s1 end;
      batch_price := round((200 + i*15 + (23-month_offset)*1.2)::numeric, 2);
      insert into powder_batches (powder_id, supplier_id, qty_kg, remaining_qty_kg, price_per_kg, purchase_date)
      values (pow_id, supplier_choice, 40 + (i*5), 40 + (i*5), batch_price, month_start + 2);
    end loop;

    -- 3-5 jobs this month
    jobs_this_month := 3 + (month_offset % 3);
    for j in 1..jobs_this_month loop
      cust_id := customer_ids[1 + floor(random()*array_length(customer_ids,1))::int];
      pow_id := powder_ids[1 + floor(random()*array_length(powder_ids,1))::int];
      qty := 5 + floor(random()*20)::int;

      -- For the current month, only use days that have actually elapsed so far
      -- (avoids generating "future" received/completed dates).
      if month_offset = 0 then
        date_recv := month_start + floor(random() * greatest(extract(day from current_date)::int - 1, 1))::int;
      else
        date_recv := month_start + floor(random()*20)::int;
      end if;
      date_prom := date_recv + (5 + floor(random()*7)::int);

      jobnum := 'PC-' || extract(year from date_recv)::int || '-' || lpad(seq::text, 4, '0');
      seq := seq + 1;

      -- Older months are fully closed out; only the current month has a live mix of statuses
      if month_offset >= 1 then
        new_status := 'delivered';
      elsif j <= greatest(jobs_this_month - 2, 1) then
        new_status := 'approved';
      elsif j = jobs_this_month - 1 then
        new_status := 'in_process';
      else
        new_status := 'received';
      end if;

      if new_status in ('delivered','approved') then
        if month_offset = 0 then
          -- keep completion date realistic: after received, never after today
          date_comp := least(date_recv + 2 + floor(random()*3)::int, current_date);
        else
          date_comp := date_prom + (case when random() < 0.2 then floor(random()*5)::int else -floor(random()*3)::int end);
        end if;
        consumed := round((qty * (0.15 + random()*0.1))::numeric, 2);
        price_charged_val := round((qty * (180 + random()*120))::numeric, 2);
      else
        date_comp := null;
        consumed := null;
        price_charged_val := null;
      end if;

      insert into jobs (
        job_number, customer_id, product_name, qty_received, powder_id,
        date_received, date_promised, date_completed, status,
        powder_consumed_kg, price_charged
      ) values (
        jobnum, cust_id, product_names[1 + floor(random()*array_length(product_names,1))::int], qty, pow_id,
        date_recv, date_prom, date_comp, new_status,
        consumed, price_charged_val
      ) returning id into job_id;

      -- FIFO-consistent stock deduction for any job with consumption
      if consumed is not null then
        remaining_needed := consumed;
        cost := 0;
        for batch in
          select * from powder_batches where powder_id = pow_id and remaining_qty_kg > 0 order by purchase_date, created_at
        loop
          exit when remaining_needed <= 0;
          take := least(batch.remaining_qty_kg, remaining_needed);
          update powder_batches set remaining_qty_kg = remaining_qty_kg - take where id = batch.id;
          insert into powder_consumption_lots (job_id, batch_id, qty_kg, price_per_kg) values (job_id, batch.id, take, batch.price_per_kg);
          cost := cost + take * batch.price_per_kg;
          remaining_needed := remaining_needed - take;
        end loop;
        update jobs set powder_cost = round(cost,2) where id = job_id;
      end if;

      -- Payment status + method (only meaningful once a price has been charged)
      if new_status = 'delivered' then
        pay_status := case when random() < 0.7 then 'paid' when random() < 0.6 then 'advance' else 'unpaid' end;
        pay_method := (array['cash','cheque','upi','bank_transfer'])[1 + floor(random()*4)::int];
        update jobs set
          payment_status = pay_status,
          payment_method = (case when pay_status = 'unpaid' then null else pay_method end),
          advance_amount = (case when pay_status = 'advance' then round(price_charged_val*0.4,2) when pay_status = 'paid' then price_charged_val else 0 end)
        where id = job_id;
      elsif new_status = 'approved' then
        pay_status := case when random() < 0.4 then 'advance' else 'unpaid' end;
        pay_method := (array['cash','upi'])[1 + floor(random()*2)::int];
        update jobs set
          payment_status = pay_status,
          payment_method = (case when pay_status = 'unpaid' then null else pay_method end),
          advance_amount = (case when pay_status = 'advance' then round(price_charged_val*0.3,2) else 0 end)
        where id = job_id;
      end if;
    end loop;

    -- Monthly recurring expenses
    insert into expenses (expense_date, category, description, amount) values
      (month_start + 27, 'wages', 'Staff wages', round((18000 + (23-month_offset)*250 + random()*1000)::numeric,2)),
      (month_start + 5,  'electricity', 'Electricity bill', round((3200 + random()*1500)::numeric,2)),
      (month_start + 15, 'other', 'Misc consumables / diesel', round((800 + random()*1200)::numeric,2));
  end loop;

  -- ============ ASSETS ============
  insert into assets (name, asset_type, purchase_price, purchase_date, useful_life_years) values
    ('Office TV', 'depreciable', 25000, (current_date - interval '20 months')::date, 5),
    ('Chairs & Furniture', 'depreciable', 18000, (current_date - interval '18 months')::date, 4),
    ('Powder Coating Oven Blower', 'depreciable', 65000, (current_date - interval '10 months')::date, 8);

  -- One big non-depreciating capital purchase, to exercise the Land/Capital section
  insert into assets (name, asset_type, purchase_price, purchase_date, useful_life_years) values
    ('Plot of Land - MIDC Thane', 'land', 2500000, (current_date - interval '14 months')::date, null);

end $$;

-- Drop the temporary defaults set above, now that every row has an explicit company_id.
alter table suppliers alter column company_id drop default;
alter table customers alter column company_id drop default;
alter table powders alter column company_id drop default;
alter table powder_batches alter column company_id drop default;
alter table jobs alter column company_id drop default;
alter table expenses alter column company_id drop default;
alter table assets alter column company_id drop default;
