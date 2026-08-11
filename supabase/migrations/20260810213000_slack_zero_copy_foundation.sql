create table if not exists public.slack_installations (
  id uuid primary key default gen_random_uuid(),
  slack_team_id text not null unique,
  slack_enterprise_id text,
  installer_user_id uuid references auth.users(id) on delete set null,
  encrypted_bot_access_token text,
  encrypted_bot_refresh_token text,
  bot_token_expires_at timestamptz,
  granted_bot_scopes text[] not null default '{}'::text[],
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  check (btrim(slack_team_id) <> ''),
  check (encrypted_bot_access_token is null or encrypted_bot_access_token like 'v1.%'),
  check (encrypted_bot_refresh_token is null or encrypted_bot_refresh_token like 'v1.%')
);

create table if not exists public.slack_user_links (
  id uuid primary key default gen_random_uuid(),
  slack_team_id text not null,
  slack_user_id text not null,
  beckett_user_id uuid references auth.users(id) on delete set null,
  encrypted_user_access_token text,
  encrypted_user_refresh_token text,
  user_token_expires_at timestamptz,
  granted_user_scopes text[] not null default '{}'::text[],
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disconnected_at timestamptz,
  unique (slack_team_id, slack_user_id),
  check (btrim(slack_team_id) <> ''),
  check (btrim(slack_user_id) <> ''),
  check (encrypted_user_access_token is null or encrypted_user_access_token like 'v1.%'),
  check (encrypted_user_refresh_token is null or encrypted_user_refresh_token like 'v1.%')
);

create table if not exists public.slack_flow_sessions (
  id uuid primary key default gen_random_uuid(),
  beckett_user_id uuid references auth.users(id) on delete set null,
  slack_team_id text not null,
  slack_user_id text not null,
  slack_channel_id text,
  slack_thread_ts text,
  slack_message_ts text,
  slack_source_channel_id text,
  slack_source_thread_ts text,
  slack_source_message_ts text,
  flow_type text not null default 'general' check (flow_type in ('general', 'decode', 'respond', 'rewrite', 'relationship', 'message', 'prep', 'practice')),
  current_step text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived', 'failed')),
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  archived_at timestamptz,
  check (btrim(slack_team_id) <> ''),
  check (btrim(slack_user_id) <> ''),
  check (current_step is null or current_step ~ '^[A-Za-z0-9._:-]{1,96}$'),
  check (request_id is null or request_id ~ '^[A-Za-z0-9._:-]{1,255}$')
);

create unique index if not exists slack_flow_sessions_thread_unique_idx
  on public.slack_flow_sessions (slack_team_id, slack_user_id, slack_channel_id, slack_thread_ts);

create index if not exists slack_flow_sessions_user_recent_idx
  on public.slack_flow_sessions (beckett_user_id, updated_at desc)
  where beckett_user_id is not null;

create index if not exists slack_flow_sessions_active_lookup_idx
  on public.slack_flow_sessions (slack_team_id, slack_user_id, slack_channel_id, updated_at desc)
  where status = 'active';

create table if not exists public.slack_flow_bot_messages (
  id uuid primary key default gen_random_uuid(),
  flow_session_id uuid references public.slack_flow_sessions(id) on delete cascade not null,
  beckett_user_id uuid references auth.users(id) on delete set null,
  slack_channel_id text not null,
  slack_message_ts text not null,
  kind text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (flow_session_id, slack_channel_id, slack_message_ts),
  check (btrim(slack_channel_id) <> ''),
  check (btrim(slack_message_ts) <> ''),
  check (kind is null or kind ~ '^[A-Za-z0-9._:-]{1,96}$')
);

create table if not exists public.slack_usage_events (
  id uuid primary key default gen_random_uuid(),
  beckett_user_id uuid references auth.users(id) on delete set null,
  slack_team_id text not null,
  slack_user_id text not null,
  event_type text not null,
  flow_type text check (flow_type is null or flow_type in ('general', 'decode', 'respond', 'rewrite', 'relationship', 'message', 'prep', 'practice')),
  request_id text,
  credits_charged integer not null default 0 check (credits_charged >= 0),
  success boolean not null default true,
  error_code text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  search_available boolean,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (btrim(slack_team_id) <> ''),
  check (btrim(slack_user_id) <> ''),
  check (event_type ~ '^[A-Za-z0-9._:-]{1,96}$'),
  check (error_code is null or error_code ~ '^[A-Za-z0-9._:-]{1,96}$'),
  check (request_id is null or request_id ~ '^[A-Za-z0-9._:-]{1,255}$')
);

create unique index if not exists slack_usage_events_request_unique_idx
  on public.slack_usage_events (slack_team_id, slack_user_id, request_id, event_type)
  where request_id is not null;

create index if not exists slack_usage_events_daily_lookup_idx
  on public.slack_usage_events (slack_team_id, slack_user_id, occurred_at desc);

alter table public.slack_installations enable row level security;
alter table public.slack_user_links enable row level security;
alter table public.slack_flow_sessions enable row level security;
alter table public.slack_flow_bot_messages enable row level security;
alter table public.slack_usage_events enable row level security;

revoke all on table public.slack_installations from public, anon, authenticated;
revoke all on table public.slack_user_links from public, anon, authenticated;
revoke all on table public.slack_flow_sessions from public, anon, authenticated;
revoke all on table public.slack_flow_bot_messages from public, anon, authenticated;
revoke all on table public.slack_usage_events from public, anon, authenticated;

grant select, insert, update, delete on table public.slack_installations to service_role;
grant select, insert, update, delete on table public.slack_user_links to service_role;
grant select, insert, update, delete on table public.slack_flow_sessions to service_role;
grant select, insert, update, delete on table public.slack_flow_bot_messages to service_role;
grant select, insert, update, delete on table public.slack_usage_events to service_role;

alter table public.slack_agent_sessions
  add column if not exists zero_copy_flow_session_id uuid references public.slack_flow_sessions(id) on delete set null;

create index if not exists slack_agent_sessions_zero_copy_flow_idx
  on public.slack_agent_sessions (zero_copy_flow_session_id);

comment on table public.slack_installations is 'Encrypted, content-free Slack workspace installation records.';
comment on table public.slack_user_links is 'Content-free Slack-to-Beckett identity and optional user-token links.';
comment on table public.slack_flow_sessions is 'Metadata-only Slack flow state. Slack remains the transcript system of record.';
comment on table public.slack_flow_bot_messages is 'Opaque references to Beckett-authored Slack messages used for navigation and cleanup.';
comment on table public.slack_usage_events is 'Content-free Slack entitlement, credit, and operational usage events.';
