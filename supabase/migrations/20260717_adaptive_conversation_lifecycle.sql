-- Add the shared lifecycle field to simulator sessions created by the first migration.
alter table public.adaptive_conversation_sessions
  add column if not exists lifecycle text not null default 'ready';

update public.adaptive_conversation_sessions
set lifecycle = case
  when status = 'completed' then 'completed'
  when status = 'abandoned' then 'abandoned'
  else 'ready'
end
where lifecycle is null;

alter table public.adaptive_conversation_sessions
  drop constraint if exists adaptive_conversation_sessions_lifecycle_check;

alter table public.adaptive_conversation_sessions
  add constraint adaptive_conversation_sessions_lifecycle_check
  check (lifecycle in ('setup', 'ready', 'responding', 'paused', 'help', 'completed', 'abandoned'));
