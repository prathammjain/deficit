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

-- ---- Admin, access and CRM (added 2026-11-08) ------------------------------
-- Safe to run again: every statement checks before it creates.

-- Admins: who can open the admin screens. Add yourself once, in the SQL
-- editor, with the email you sign in to Grain with:
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
create table if not exists public.admins (
  user_id  uuid        primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies: clients never read this table. is_admin() does.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- The paywall switch: one row, off until payments are live. Off means every
-- signed in user gets every feature.
create table if not exists public.app_settings (
  id              integer     primary key default 1 check (id = 1),
  paywall_enabled boolean     not null default false,
  updated_at      timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict do nothing;
alter table public.app_settings enable row level security;

drop policy if exists "signed in select" on public.app_settings;
create policy "signed in select" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "admin update" on public.app_settings;
create policy "admin update" on public.app_settings
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Premium access: one row per user who has it; no row means free. Admins
-- gift it by hand; paid subscriptions will write here too once payments exist.
create table if not exists public.premium_access (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  source     text        not null default 'gift'
             check (source in ('gift', 'subscription')),
  ends_at    timestamptz,               -- null: no end date
  note       text,
  granted_by uuid        references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.premium_access enable row level security;

drop policy if exists "own row select" on public.premium_access;
create policy "own row select" on public.premium_access
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "admin all" on public.premium_access;
create policy "admin all" on public.premium_access
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- What the signed in user may use, for the app.
create or replace function public.my_access()
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'paywall', s.paywall_enabled,
    'premium_source', p.source,
    'premium_ends_at', p.ends_at,
    'premium_active',
      p.user_id is not null and (p.ends_at is null or p.ends_at > now()),
    'admin', public.is_admin()
  )
  from public.app_settings s
  left join public.premium_access p on p.user_id = auth.uid()
  where s.id = 1;
$$;

-- Entries in one stored day log. An empty day or bad JSON counts as none.
create or replace function public.log_entry_count(v text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
begin
  return coalesce(json_array_length(v::json), 0);
exception when others then
  return 0;
end;
$$;

-- The admin user list: account details and activity counts, never meals.
-- `search` matches part of an email, or a whole user id.
create or replace function public.admin_users(search text default null)
returns table (
  user_id         uuid,
  email           text,
  joined_at       timestamptz,
  last_active_at  timestamptz,
  days_logged     integer,
  meals_logged    integer,
  premium_source  text,
  premium_ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, u.created_at,
         k.last_active_at, coalesce(k.days_logged, 0), coalesce(k.meals_logged, 0),
         p.source, p.ends_at
  from auth.users u
  left join lateral (
    select max(kv.updated_at) as last_active_at,
           (count(*) filter (
              where kv.key like 'deficit.log.v1.%'
                and public.log_entry_count(kv.value) > 0))::integer as days_logged,
           (coalesce(sum(public.log_entry_count(kv.value)) filter (
              where kv.key like 'deficit.log.v1.%'), 0))::integer as meals_logged
    from public.user_kv kv
    where kv.user_id = u.id
  ) k on true
  left join public.premium_access p on p.user_id = u.id
  where search is null or search = ''
     or u.email ilike '%' || search || '%'
     or u.id::text = search
  order by u.created_at desc
  limit 500;
end;
$$;

-- The numbers behind the admin Stats screen. Aggregates only. Days are
-- counted in India time; a meal log counts on the user's own date for it.
create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz     constant text := 'Asia/Kolkata';
  today  date := (now() at time zone tz)::date;
  result json;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  with
  days as (
    select (today - g)::date as day from generate_series(29, 0, -1) as g
  ),
  users as (
    select u.id, (u.created_at at time zone tz)::date as joined
    from auth.users u
  ),
  logs as (
    select kv.user_id,
           substr(kv.key, 16)::date as day,
           public.log_entry_count(kv.value) as meals
    from public.user_kv kv
    where kv.key ~ '^deficit\.log\.v1\.\d{4}-\d{2}-\d{2}$'
      and public.log_entry_count(kv.value) > 0
  ),
  runs as (
    select (r.created_at at time zone tz)::date as day,
           r.cached, r.degraded, r.latency_ms
    from public.engine_runs r
    where r.created_at >= (today - 29)::timestamp at time zone tz
  )
  select json_build_object(
    'today', today,
    'users', json_build_object(
      'total', (select count(*) from users),
      'today', (select count(*) from users where joined = today),
      'week',  (select count(*) from users where joined > today - 7),
      'month', (select count(*) from users where joined > today - 30)
    ),
    'signups_by_day', (
      select json_agg(coalesce(c.n, 0) order by d.day)
      from days d
      left join (select joined, count(*) as n from users group by joined) c
        on c.joined = d.day
    ),
    'loggers', json_build_object(
      'today', (select count(distinct user_id) from logs where day = today),
      'week',  (select count(distinct user_id) from logs where day > today - 7),
      'month', (select count(distinct user_id) from logs where day > today - 30)
    ),
    'loggers_by_day', (
      select json_agg(coalesce(c.n, 0) order by d.day)
      from days d
      left join (select day, count(distinct user_id) as n from logs group by day) c
        on c.day = d.day
    ),
    'meals_by_day', (
      select json_agg(coalesce(c.n, 0) order by d.day)
      from days d
      left join (select day, sum(meals) as n from logs group by day) c
        on c.day = d.day
    ),
    'activation', json_build_object(
      'joined', (select count(*) from users where joined > today - 30),
      'logged', (
        select count(*) from users u
        where u.joined > today - 30
          and exists (select 1 from logs l where l.user_id = u.id)
      )
    ),
    'retention', json_build_object(
      'joined', (
        select count(*) from users where joined between today - 27 and today - 14
      ),
      'returned', (
        select count(*) from users u
        where u.joined between today - 27 and today - 14
          and exists (
            select 1 from logs l
            where l.user_id = u.id
              and l.day between u.joined + 7 and u.joined + 13
          )
      )
    ),
    'engine', json_build_object(
      'runs_by_day', (
        select json_agg(coalesce(c.n, 0) order by d.day)
        from days d
        left join (select day, count(*) as n from runs group by day) c
          on c.day = d.day
      ),
      'week_runs', (select count(*) from runs where day > today - 7),
      'week_degraded', (
        select count(*) from runs where day > today - 7 and degraded
      ),
      'week_cached', (select count(*) from runs where day > today - 7 and cached),
      'week_median_ms', (
        select percentile_cont(0.5) within group (order by latency_ms)
        from runs
        where day > today - 7 and not cached and latency_ms is not null
      )
    ),
    'premium', json_build_object(
      'paywall', (select paywall_enabled from public.app_settings where id = 1),
      'gifted', (
        select count(*) from public.premium_access
        where source = 'gift' and (ends_at is null or ends_at > now())
      ),
      'paid', (
        select count(*) from public.premium_access
        where source = 'subscription' and (ends_at is null or ends_at > now())
      )
    )
  ) into result;

  return result;
end;
$$;

-- CRM: the athletes and creators Grain works with. Admins only.
create table if not exists public.crm_creators (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null,
  handle         text,
  platform       text,          -- main platform: instagram, youtube, x, other
  niche          text,          -- powerlifting, bodybuilding, physique, coach...
  city           text,
  country        text,
  email          text,
  phone          text,
  stage          text        not null default 'prospect'
                 check (stage in ('prospect', 'contacted', 'replied',
                                  'onboarded', 'active', 'partner', 'declined')),
  next_follow_up date,
  grain_user_id  uuid        references auth.users (id) on delete set null,
  track_record   text,          -- titles, achievements, past brand work
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Every metrics update is kept, so a pitch can show growth, not one number.
create table if not exists public.crm_metrics (
  id              uuid        primary key default gen_random_uuid(),
  creator_id      uuid        not null references public.crm_creators (id) on delete cascade,
  platform        text        not null,
  recorded_on     date        not null default current_date,
  followers       integer,
  reach           integer,        -- as the platform reports it
  weekly_views    integer,
  total_views     bigint,
  engagement_rate numeric(5, 2),  -- percent
  created_at      timestamptz not null default now()
);
create index if not exists crm_metrics_creator
  on public.crm_metrics (creator_id, recorded_on desc);

-- Every DM, call and message, and what was said.
create table if not exists public.crm_touches (
  id          uuid        primary key default gen_random_uuid(),
  creator_id  uuid        not null references public.crm_creators (id) on delete cascade,
  happened_on date        not null default current_date,
  channel     text,          -- instagram, whatsapp, email, call, in person
  summary     text        not null,
  created_at  timestamptz not null default now()
);
create index if not exists crm_touches_creator
  on public.crm_touches (creator_id, happened_on desc);

alter table public.crm_creators enable row level security;
alter table public.crm_metrics enable row level security;
alter table public.crm_touches enable row level security;

drop policy if exists "admin all" on public.crm_creators;
create policy "admin all" on public.crm_creators
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.crm_metrics;
create policy "admin all" on public.crm_metrics
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all" on public.crm_touches;
create policy "admin all" on public.crm_touches
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
