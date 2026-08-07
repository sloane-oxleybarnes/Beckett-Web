alter table public.google_workspace_analysis_cache
  add column if not exists message_ids text[] not null default '{}';

create index if not exists google_workspace_analysis_cache_message_ids_idx
  on public.google_workspace_analysis_cache using gin (message_ids);
