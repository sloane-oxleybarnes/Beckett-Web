create table if not exists public.google_workspace_analysis_cache (
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id text not null,
  thread_revision text not null,
  message_ids text[] not null default '{}',
  sections jsonb not null check (jsonb_typeof(sections) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, thread_id)
);

create index if not exists google_workspace_analysis_cache_expires_idx
  on public.google_workspace_analysis_cache (expires_at);

alter table public.google_workspace_analysis_cache enable row level security;

revoke all on table public.google_workspace_analysis_cache from anon, authenticated;
grant select, insert, update, delete on table public.google_workspace_analysis_cache to service_role;

drop policy if exists "Service role manages Google Workspace analysis cache"
  on public.google_workspace_analysis_cache;
create policy "Service role manages Google Workspace analysis cache"
  on public.google_workspace_analysis_cache
  for all
  to service_role
  using (true)
  with check (true);
