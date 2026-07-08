-- Deficit — database schema.
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- One generic key/value table per user. The app already serializes everything
-- (profile, daily logs, workouts, weigh-ins) as JSON strings under stable keys,
-- so a single table keeps things simple and future-proof. Row-level security
-- guarantees each user can only ever see their own rows.

create table if not exists public.user_kv (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      text        not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_kv enable row level security;

-- Each policy restricts access to the caller's own rows (auth.uid()).
drop policy if exists "own rows - select" on public.user_kv;
create policy "own rows - select" on public.user_kv
  for select using (auth.uid() = user_id);

drop policy if exists "own rows - insert" on public.user_kv;
create policy "own rows - insert" on public.user_kv
  for insert with check (auth.uid() = user_id);

drop policy if exists "own rows - update" on public.user_kv;
create policy "own rows - update" on public.user_kv
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows - delete" on public.user_kv;
create policy "own rows - delete" on public.user_kv
  for delete using (auth.uid() = user_id);

-- Shared cache for the food Edge Function's parsed-meal results. Keyed on
-- normalised meal text (user-independent), read/written only by the function
-- via the service role: RLS is enabled with NO policies, so client keys get
-- nothing and the service role (which bypasses RLS) is the only reader/writer.
create table if not exists public.food_cache (
  key        text        primary key,
  value      jsonb       not null,
  created_at timestamptz not null default now()
);

alter table public.food_cache enable row level security;
