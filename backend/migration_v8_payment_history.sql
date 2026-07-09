create table if not exists job_payments (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references jobs(id) on delete cascade,
    company_id uuid references companies(id),
    amount numeric not null check (amount > 0),
    payment_method text check (payment_method in ('cash', 'cheque', 'upi', 'bank_transfer', 'card')),
    paid_date date not null default current_date,
    created_by uuid references profiles(id),
    created_at timestamptz not null default now()
);

create index if not exists idx_job_payments_job_id on job_payments(job_id);

alter table job_payments enable row level security;