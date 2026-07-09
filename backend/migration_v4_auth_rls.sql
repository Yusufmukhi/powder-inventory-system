-- ============================================================
-- Migration v4 — Auth (roles) + Row Level Security + concurrency-safe FIFO
-- Run this in the Supabase SQL Editor after migration_v3.sql.
-- ============================================================

-- ---------- 1. PROFILES (role per logged-in user) ----------
create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    role text not null default 'shop_floor' check (role in ('owner', 'shop_floor')),
    created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- New accounts default to 'shop_floor' — promote the first/real owner manually,
-- see the note at the bottom of this file.
create or replace function handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'shop_floor');
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();


-- ---------- 2. ROW LEVEL SECURITY ----------
-- Your FastAPI backend talks to Supabase using the service_role key, which
-- always bypasses RLS — so none of this affects your app's own behaviour.
-- What it DOES do: if the anon/public API key for this project is ever used
-- directly (e.g. accidentally shipped in frontend code, or someone finds
-- your project URL), these tables become completely unreadable/unwritable
-- from that key. Only your backend (service_role) and, for their own row,
-- a logged-in user's profile can be touched.

alter table suppliers enable row level security;
alter table customers enable row level security;
alter table powders enable row level security;
alter table powder_batches enable row level security;
alter table jobs enable row level security;
alter table powder_consumption_lots enable row level security;
alter table expenses enable row level security;
alter table assets enable row level security;
alter table profiles enable row level security;

-- No policies are created for the business tables on purpose — that means
-- "deny all" for anon/authenticated roles, while service_role (your backend)
-- is unaffected. This is the correct default: all real access should go
-- through your API, which enforces the owner/shop_floor rules in Python.

-- Logged-in users may read their own profile row (so the frontend can show
-- "logged in as X (owner)") but not anyone else's, and can't change their own role.
create policy "Users can read their own profile"
    on profiles for select
    using (auth.uid() = id);


-- ---------- 3. ATOMIC, CONCURRENCY-SAFE FIFO CONSUMPTION ----------
-- Previously the backend read batches, then updated them, in separate
-- round trips from Python. If two jobs were approved for the same powder
-- shade at nearly the same moment, both could read the same "remaining_qty_kg"
-- before either write landed, double-spending the same stock.
--
-- This function does the whole read -> lock -> deduct -> log sequence in a
-- single database transaction, using "for update" to lock the batch rows
-- being consumed until the transaction commits. A second concurrent call for
-- the same powder will simply wait its turn instead of racing.

create or replace function consume_powder_fifo(
    p_powder_id uuid,
    p_qty_needed numeric,
    p_job_id uuid
) returns numeric as $$
declare
    v_batch record;
    v_available numeric := 0;
    v_remaining_needed numeric := p_qty_needed;
    v_take numeric;
    v_total_cost numeric := 0;
begin
    -- Lock every batch row for this powder that still has stock, oldest first,
    -- for the remainder of this transaction.
    for v_batch in
        select * from powder_batches
        where powder_id = p_powder_id and remaining_qty_kg > 0
        order by purchase_date asc, created_at asc
        for update
    loop
        v_available := v_available + v_batch.remaining_qty_kg;
    end loop;

    if v_available < p_qty_needed then
        raise exception 'Insufficient powder stock. Available: %kg, required: %kg.', v_available, p_qty_needed;
    end if;

    for v_batch in
        select * from powder_batches
        where powder_id = p_powder_id and remaining_qty_kg > 0
        order by purchase_date asc, created_at asc
        for update
    loop
        exit when v_remaining_needed <= 0;

        v_take := least(v_batch.remaining_qty_kg, v_remaining_needed);

        update powder_batches
            set remaining_qty_kg = remaining_qty_kg - v_take
            where id = v_batch.id;

        insert into powder_consumption_lots (job_id, batch_id, qty_kg, price_per_kg)
            values (p_job_id, v_batch.id, v_take, v_batch.price_per_kg);

        v_total_cost := v_total_cost + (v_take * v_batch.price_per_kg);
        v_remaining_needed := v_remaining_needed - v_take;
    end loop;

    return round(v_total_cost, 2);
end;
$$ language plpgsql;


-- ---------- 4. PROMOTE YOUR OWNER ACCOUNT ----------
-- After you sign up in the app with your own email once, run this
-- (with your real email) to make that account the Owner:
--
-- update profiles set role = 'owner' where email = 'yourname@example.com';
