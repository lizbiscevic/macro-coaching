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
