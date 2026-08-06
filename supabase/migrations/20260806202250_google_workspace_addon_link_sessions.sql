create table if not exists public.google_workspace_addon_link_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  google_subject text not null,
  google_email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.google_workspace_addon_link_sessions enable row level security;

create index if not exists google_workspace_addon_link_sessions_expires_idx
  on public.google_workspace_addon_link_sessions (expires_at);

create unique index if not exists user_integrations_google_workspace_subject_idx
  on public.user_integrations (external_user_id)
  where provider = 'google_workspace_addon' and external_user_id is not null;

comment on table public.google_workspace_addon_link_sessions is
  'Short-lived, server-only tokens for explicitly linking a verified Google Workspace add-on identity to a Beckett account.';
