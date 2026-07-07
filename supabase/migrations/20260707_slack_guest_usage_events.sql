create table if not exists public.slack_guest_usage_events (
  id uuid primary key default gen_random_uuid(),
  slack_team_id text not null,
  slack_user_id text not null,
  source text not null default 'slack_guest',
  action text not null,
  token_estimate integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.slack_guest_usage_events enable row level security;

create index if not exists slack_guest_usage_events_lookup_idx
  on public.slack_guest_usage_events (slack_team_id, slack_user_id, created_at desc);
