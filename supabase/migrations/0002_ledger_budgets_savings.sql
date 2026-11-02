-- WealthOS migration 0002 — unified ledger, budgets, savings goals
--
-- DESIGN DECISION (spec Part 4.4, Part 8 "adjust schema where justified"):
-- ONE `transactions` ledger with a `type` column is the source of truth
-- for income, expenses, transfers, refunds and reimbursements. Income and
-- expense pages are filtered views of this ledger. This makes
-- double-counting structurally impossible: a transfer is never income and
-- never spending, by construction.
--
-- Money: numeric(18,2), read and written as TEXT through PostgREST
-- (`amount::text`) so no JavaScript float ever touches an amount.

-- ─── transactions (unified ledger) ────────────────────────────────────────
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in
    ('income', 'expense', 'transfer', 'refund', 'reimbursement')),
  tx_date date not null,
  amount numeric(18, 2) not null check (amount > 0),
  description text not null default '',
  -- income source (income) or merchant/payee (expense) — one context column
  source text not null default '',
  category_id uuid references public.expense_categories (id) on delete set null,
  payment_method text,
  notes text,
  is_recurring boolean not null default false,
  -- duplicate detection: deterministic app-side hash of
  -- (type, tx_date, amount, normalised description, normalised source)
  content_hash text not null default '',
  -- groups rows created by one CSV import
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, tx_date desc);
create index transactions_user_type_idx on public.transactions (user_id, type);
create index transactions_user_hash_idx on public.transactions (user_id, content_hash);

-- ─── budgets ──────────────────────────────────────────────────────────────
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- null category = overall monthly budget
  category_id uuid references public.expense_categories (id) on delete cascade,
  amount numeric(18, 2) not null check (amount > 0),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index budgets_user_period_idx on public.budgets (user_id, period_start);

-- ─── savings_goals ────────────────────────────────────────────────────────
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null default 'short_term' check (kind in
    ('emergency', 'short_term', 'long_term')),
  target_amount numeric(18, 2) not null check (target_amount > 0),
  current_amount numeric(18, 2) not null default 0 check (current_amount >= 0),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index savings_goals_user_idx on public.savings_goals (user_id);

-- ─── Row Level Security ───────────────────────────────────────────────────
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;

create policy "users own their transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own their budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own their savings goals" on public.savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
