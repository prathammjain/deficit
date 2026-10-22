-- Grain — database schema.
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

-- ---- Engine platform: run log, corrections, engine switch -----------------
-- Written and read only by the food Edge Function and the playground, through
-- the service role. RLS is on with NO policies, so client keys get nothing.
-- Rows carry `user_ref`, a salted hash of the user id, never a name or email.

-- One row per Match: the meal text, every stage's output and the answer.
create table if not exists public.engine_runs (
  id         uuid        primary key,
  created_at timestamptz not null default now(),
  user_ref   text,
  arm        text        not null,          -- 'live' | 'beta'
  engine     text        not null,          -- e.g. 'v4/groq/openai/gpt-oss-120b'
  text       text        not null,
  result     jsonb,
  trace      jsonb,
  latency_ms integer,
  cached     boolean     not null default false,
  degraded   boolean     not null default false,
  error      text
);
create index if not exists engine_runs_created on public.engine_runs (created_at desc);
create index if not exists engine_runs_user_day on public.engine_runs (user_ref, arm, created_at);
alter table public.engine_runs enable row level security;

-- What the user actually logged from a run, after their edits.
create table if not exists public.engine_corrections (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id     uuid        not null references public.engine_runs (id) on delete cascade,
  user_ref   text,
  logged     jsonb       not null
);
create index if not exists engine_corrections_run on public.engine_corrections (run_id);
alter table public.engine_corrections enable row level security;

-- The engine switch: a single row. Beta stays off until a model is set and
-- beta_enabled is true; then testers, plus rollout_percent of everyone else,
-- get it, up to beta_daily_cap uncached runs per user per day.
create table if not exists public.engine_settings (
  id              integer     primary key default 1 check (id = 1),
  beta_enabled    boolean     not null default false,
  beta_provider   text,                    -- 'groq' | 'openai'
  beta_model      text,
  rollout_percent integer     not null default 0 check (rollout_percent between 0 and 100),
  beta_daily_cap  integer     not null default 30,
  updated_at      timestamptz not null default now()
);
insert into public.engine_settings (id) values (1) on conflict do nothing;
alter table public.engine_settings enable row level security;

-- Testers who get the beta engine regardless of rollout_percent.
create table if not exists public.engine_testers (
  user_id  uuid        primary key references auth.users (id) on delete cascade,
  note     text,
  added_at timestamptz not null default now()
);
alter table public.engine_testers enable row level security;
