-- Short-lived, server-only handoff records used to link an Outlook SSO identity
-- to a Beckett account without relying on third-party browser cookies.
create table if not exists public.outlook_sso_link_attempts (
  id uuid primary key default gen_random_uuid(),
  microsoft_user_id text not null unique,
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.outlook_sso_link_attempts enable row level security;

-- No client policies: only Beckett's server-side service role can create,
-- inspect, or claim these records after verifying Microsoft and Beckett tokens.
create index if not exists outlook_sso_link_attempts_expires_at_idx
  on public.outlook_sso_link_attempts (expires_at);
