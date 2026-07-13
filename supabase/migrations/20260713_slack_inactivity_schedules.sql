create table if not exists public.slack_inactivity_schedules (
  channel_id text primary key,
  generation text not null,
  scheduled_message_id text,
  updated_at timestamptz not null default now()
);

alter table public.slack_inactivity_schedules enable row level security;

comment on table public.slack_inactivity_schedules is
  'Service-role-only debounce state for Beckett Slack inactivity menus.';
