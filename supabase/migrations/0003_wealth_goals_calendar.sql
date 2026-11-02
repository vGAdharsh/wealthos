-- WealthOS migration 0003 — wealth: investments, assets, liabilities,
-- net-worth snapshots, financial goals, calendar + Needs/Wants columns.
-- Money: numeric(18,2) everywhere (exact decimal, never float).

-- ─── investments (portfolio holdings; valuations are USER-ENTERED) ───────
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  investment_type text not null check (investment_type in
    ('mutual_fund', 'sip', 'equity', 'etf', 'fixed_deposit',
     'recurring_deposit', 'bond', 'government_scheme', 'other')),
  institution text,
  purchase_date date,
  invested_amount numeric(18, 2) not null check (invested_amount > 0),
  units numeric(20, 6),
  nav_or_price numeric(20, 6),
  current_value numeric(18, 2) not null default 0 check (current_value >= 0),
  valuation_as_of date,
  maturity_date date,
  interest_rate numeric(6, 3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index investments_user_idx on public.investments (user_id);

-- ─── investment_transactions (dated flows → XIRR) ────────────────────────
create table public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  investment_id uuid not null references public.investments (id) on delete cascade,
  tx_date date not null,
  amount numeric(18, 2) not null check (amount > 0),
  kind text not null check (kind in ('contribution', 'withdrawal')),
  created_at timestamptz not null default now()
);
create index inv_tx_user_idx on public.investment_transactions (user_id, investment_id);

-- ─── assets ───────────────────────────────────────────────────────────────
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_type text not null check (asset_type in
    ('bank', 'cash', 'fixed_deposit', 'property', 'vehicle', 'gold', 'other')),
  name text not null,
  value numeric(18, 2) not null check (value >= 0),
  valuation_as_of date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_user_idx on public.assets (user_id);

-- ─── liabilities ──────────────────────────────────────────────────────────
create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  liability_type text not null check (liability_type in
    ('credit_card', 'personal_loan', 'home_loan', 'vehicle_loan',
     'education_loan', 'other')),
  name text not null,
  outstanding numeric(18, 2) not null check (outstanding >= 0),
  interest_rate numeric(6, 3),
  emi_amount numeric(18, 2),
  emi_due_day smallint check (emi_due_day between 1 and 31),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index liabilities_user_idx on public.liabilities (user_id);

-- ─── net_worth_snapshots (one per user per day) ───────────────────────────
create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  total_assets numeric(18, 2) not null,
  total_liabilities numeric(18, 2) not null,
  net_worth numeric(18, 2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

-- ─── financial_goals (purchase/wealth goals; savings_goals stay for funds)
create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  goal_type text not null check (goal_type in
    ('emergency_fund', 'vehicle', 'home', 'education', 'travel',
     'retirement', 'wealth', 'custom')),
  target_amount numeric(18, 2) not null check (target_amount > 0),
  current_amount numeric(18, 2) not null default 0 check (current_amount >= 0),
  target_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  contribution_frequency text not null default 'monthly' check
    (contribution_frequency in ('monthly', 'quarterly', 'yearly', 'one_time')),
  linked_account text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index financial_goals_user_idx on public.financial_goals (user_id);

-- ─── calendar_events ──────────────────────────────────────────────────────
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  event_type text not null check (event_type in
    ('salary', 'rent', 'utility', 'insurance', 'emi', 'sip',
     'fd_maturity', 'card_due', 'savings', 'custom')),
  event_date date not null,
  recurrence text not null default 'none' check (recurrence in ('none', 'monthly', 'quarterly', 'yearly')),
  amount numeric(18, 2),
  notes text,
  created_at timestamptz not null default now()
);
create index calendar_events_user_idx on public.calendar_events (user_id, event_date);

-- ─── Needs/Wants classification on ledger rows (spec Part 5.3) ───────────
alter table public.transactions
  add column if not exists nw_classification text check
    (nw_classification in ('essential_need', 'discretionary_want', 'mixed', 'uncertain')),
  add column if not exists nw_is_override boolean not null default false,
  add column if not exists nw_reasoning text;

-- ─── RLS on every new user-owned table ────────────────────────────────────
alter table public.investments enable row level security;
alter table public.investment_transactions enable row level security;
alter table public.assets enable row level security;
alter table public.liabilities enable row level security;
alter table public.net_worth_snapshots enable row level security;
alter table public.financial_goals enable row level security;
alter table public.calendar_events enable row level security;

create policy "users own their investments" on public.investments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their investment flows" on public.investment_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their assets" on public.assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their liabilities" on public.liabilities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their net-worth snapshots" on public.net_worth_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their financial goals" on public.financial_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own their calendar events" on public.calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
