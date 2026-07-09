-- ============================================================
-- Powder Coating Inventory & Job Management — Schema v2
-- FIFO batch costing, suppliers, expenses & depreciation
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- SUPPLIERS ----------
create table suppliers (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    contact_number text,
    created_at timestamptz not null default now()
);

-- ---------- CUSTOMERS ----------
create table customers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    contact_number text,
    address text,
    created_at timestamptz not null default now()
);

-- ---------- POWDERS (just the shade + default supplier) ----------
create table powders (
    id uuid primary key default gen_random_uuid(),
    shade_name text not null,
    default_supplier_id uuid references suppliers(id),
    reorder_threshold_kg numeric(10,3) not null default 5,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------- POWDER BATCHES (one row per stock-in; this is the FIFO lot) ----------
create table powder_batches (
    id uuid primary key default gen_random_uuid(),
    powder_id uuid not null references powders(id) on delete restrict,
    supplier_id uuid references suppliers(id),
    qty_kg numeric(10,3) not null,
    remaining_qty_kg numeric(10,3) not null,
    price_per_kg numeric(10,2) not null,
    purchase_date date not null default current_date,
    notes text,
    created_at timestamptz not null default now()
);

-- ---------- JOBS ----------
create table jobs (
    id uuid primary key default gen_random_uuid(),
    job_number text not null unique,
    customer_id uuid not null references customers(id) on delete restrict,

    product_name text not null,
    qty_received integer not null,
    powder_id uuid not null references powders(id) on delete restrict,

    date_received date not null default current_date,
    date_promised date not null,
    date_completed date,

    status text not null default 'received'
        check (status in ('received', 'in_process', 'approved', 'delivered')),

    -- filled in at APPROVE time only
    powder_consumed_kg numeric(10,3),
    powder_cost numeric(10,2),          -- computed via FIFO batch consumption, stored for reporting
    price_charged numeric(10,2),

    payment_status text not null default 'unpaid'
        check (payment_status in ('unpaid', 'advance', 'paid')),
    payment_method text
        check (payment_method in ('cash', 'cheque', 'upi', 'bank_transfer', 'card') or payment_method is null),
    advance_amount numeric(10,2) default 0,

    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------- POWDER CONSUMPTION LOTS (which batches a job actually drew from) ----------
create table powder_consumption_lots (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references jobs(id) on delete cascade,
    batch_id uuid not null references powder_batches(id),
    qty_kg numeric(10,3) not null,
    price_per_kg numeric(10,2) not null,
    created_at timestamptz not null default now()
);

-- ---------- EXPENSES (wages, electricity, other — monthly running costs) ----------
create table expenses (
    id uuid primary key default gen_random_uuid(),
    expense_date date not null default current_date,
    category text not null,     -- 'wages' | 'electricity' | 'other'
    description text,
    amount numeric(10,2) not null,
    created_at timestamptz not null default now()
);

-- ---------- ASSETS (depreciable fixed assets AND non-depreciable capital purchases like land) ----------
create table assets (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    asset_type text not null default 'depreciable'
        check (asset_type in ('depreciable', 'land')),   -- land/property does not depreciate
    purchase_price numeric(10,2) not null,
    purchase_date date not null default current_date,
    useful_life_years numeric(5,2),                       -- null for 'land' type
    created_at timestamptz not null default now()
);

-- ---------- Indexes ----------
create index idx_jobs_status on jobs(status);
create index idx_jobs_customer on jobs(customer_id);
create index idx_batches_powder on powder_batches(powder_id);
create index idx_batches_purchase_date on powder_batches(purchase_date);
create index idx_consumption_job on powder_consumption_lots(job_id);
create index idx_consumption_batch on powder_consumption_lots(batch_id);
create index idx_expenses_date on expenses(expense_date);
