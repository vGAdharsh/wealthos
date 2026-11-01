-- WealthOS migration 0001 — foundation schema
-- Target: PostgreSQL (Supabase). Money columns: numeric(18,2) — exact
-- decimal, never float (spec Part 8). Timestamps: timestamptz (UTC).
-- Every user-owned table gets Row Level Security keyed on auth.uid().

create extension if not exists "pgcrypto";

-- ─── user_profiles ────────────────────────────────────────────────────────
create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  currency text not null default 'INR' check (currency in ('INR')),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-provision a profile whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── accounts ─────────────────────────────────────────────────────────────
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in
    ('bank', 'cash', 'wallet', 'credit_card', 'investment', 'other')),
  institution text,
  current_balance numeric(18, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_user_idx on public.accounts (user_id);

-- ─── expense_categories (system catalogue + user-defined) ─────────────────
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- null = system
  name text not null,
  is_system boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index expense_categories_user_idx on public.expense_categories (user_id);

insert into public.expense_categories (name, is_system, sort_order) values
  ('Housing & Rent', true, 10),
  ('Utilities', true, 20),
  ('Groceries', true, 30),
  ('Food & Dining', true, 40),
  ('Transportation', true, 50),
  ('Fuel', true, 60),
  ('Healthcare', true, 70),
  ('Education', true, 80),
  ('Insurance', true, 90),
  ('Shopping', true, 100),
  ('Entertainment', true, 110),
  ('Travel', true, 120),
  ('Subscriptions', true, 130),
  ('Family', true, 140),
  ('Personal Care', true, 150),
  ('Financial Obligations', true, 160),
  ('Miscellaneous', true, 999);

-- ─── user_preferences ─────────────────────────────────────────────────────
create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  fiscal_year_start_month smallint not null default 4 check (fiscal_year_start_month between 1 and 12),
  notifications jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─── audit_logs (append-only trail for important modifications) ───────────
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);

-- ─── Row Level Security (spec Part 8/9: one user must never see another's data)
alter table public.user_profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.expense_categories enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_logs enable row level security;

create policy "users own their profile" on public.user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "users own their accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own their preferences" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users own their audit trail" on public.audit_logs
  for select using (auth.uid() = user_id); -- append-only via service role

create policy "read system categories" on public.expense_categories
  for select using (is_system or auth.uid() = user_id);

create policy "users own their custom categories" on public.expense_categories
  for all using (auth.uid() = user_id and not is_system)
  with check (auth.uid() = user_id and not is_system);
