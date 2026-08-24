-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).
--
-- One row per visitor from the moment they get a valid free timeline,
-- through picking a tier, through payment. `paid` only ever gets set to
-- true by server code (the checkout-status route or the Stripe webhook),
-- never by anything the browser sends directly.

create table if not exists leads (
  id text primary key,
  name text,
  email text,
  form jsonb,
  tier text,
  start_date date,
  paid boolean not null default false,
  stripe_session_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS on with no policies: only the service role key (used exclusively
-- from server-side route handlers) can read or write this table. The
-- anon key is only ever used client-side for auth, never table access.
alter table leads enable row level security;

-- Links a lead to the Supabase Auth user created by their first magic-link
-- sign-in (post-payment). Nullable — a lead can be paid before they've ever
-- clicked their magic link.
alter table leads add column if not exists user_id uuid references auth.users(id);
create index if not exists leads_user_id_idx on leads(user_id);
create index if not exists leads_email_idx on leads(email);

-- Coach-set macro targets (coached tiers only — DIY's plan is computed on
-- the fly, never stored). plan_notified_at guards the one-time "your plan
-- is ready" auto-message so re-saving/editing doesn't re-notify.
alter table leads add column if not exists macro_targets jsonb;
alter table leads add column if not exists plan_notified_at timestamptz;

-- DIY's plan is auto-computed but not auto-released — the client sees
-- "being finalized" until the coach reviews it and approves, which is
-- what actually sets plan_notified_at/sends the client their "ready"
-- message (see /api/plan/approve). baseline_ready_notified_at guards the
-- one-time "a client finished their baseline week" email to the coach
-- herself (both tiers — DIY needs her to review, coached needs her to
-- set targets), so it doesn't refire on every re-save of week 1.
alter table leads add column if not exists diy_plan_approved_at timestamptz;
alter table leads add column if not exists baseline_ready_notified_at timestamptz;

-- One row per client per week. `unique(lead_id, week_number)` makes a
-- check-in a natural upsert target and "did they check in this week" a
-- direct row-presence check.
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references leads(id) on delete cascade,
  week_number int not null,
  weigh_in numeric,
  calories jsonb, -- 7 values, Mon..Sun
  mymacros_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, week_number)
);
alter table checkins enable row level security;
create index if not exists checkins_lead_id_idx on checkins(lead_id, week_number);

-- Daily protein, 7 values Mon..Sun, same shape as calories. Needed to
-- grade "on plan" (calories AND protein within range), not just calorie
-- adherence, per the weekly-adjustment rules.
alter table checkins add column if not exists protein jsonb;

-- Daily fat and carbs, same 7-value shape. Check-ins collect protein/fat/
-- carbs directly now rather than a single calorie number — `calories` is
-- computed from these three (protein×4 + carbs×4 + fat×9) and still
-- stored, so everything reading `calories` elsewhere keeps working
-- unchanged.
alter table checkins add column if not exists fat jsonb;
alter table checkins add column if not exists carbs jsonb;

-- Set when a diet break is applied by the weekly-adjustment tool, so the
-- coach view knows to show "on a break until X" instead of re-running the
-- slow/fast logic during a deliberate maintenance window. Left to expire
-- naturally — no auto-revert; adjustment logic resumes once it's past.
alter table leads add column if not exists diet_break_until timestamptz;

-- Progress photos — monthly, optional, reviewed by the coach on her own
-- schedule (calls or async). Deliberately not part of the weekly check-in
-- so that stays fast. Stored in a private bucket; only ever read back via
-- signed URLs generated server-side with the service role key.
create table if not exists progress_photos (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references leads(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
alter table progress_photos enable row level security;
create index if not exists progress_photos_lead_id_idx on progress_photos(lead_id, created_at);

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- Simple stored thread per client, not real-time chat. `sender` is always
-- set server-side from the authenticated session, never client-supplied.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references leads(id) on delete cascade,
  sender text not null check (sender in ('client', 'coach')),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table messages enable row level security;
create index if not exists messages_lead_id_idx on messages(lead_id, created_at);

-- My Macros+ OAuth — per-client, not coach-level. Confirmed directly with
-- their team (Aug 2026): each client does their own OAuth connection from
-- their portal, and the token you get back is already scoped to just that
-- one account — there's no "coach connects once, then looks up any client"
-- mode. The earlier mymacros_connection table modeled the wrong thing
-- (a coach-level singleton) and is unused now; left in place rather than
-- dropped since it may still exist in some environments, but nothing
-- reads or writes it anymore.
alter table leads add column if not exists mymacros_access_token text;
alter table leads add column if not exists mymacros_refresh_token text;
alter table leads add column if not exists mymacros_token_expires_at timestamptz;
alter table leads add column if not exists mymacros_user_id text;
