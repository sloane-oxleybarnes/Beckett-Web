-- Remove legacy default privileges and keep only the operations the app uses.
revoke all on table public.adaptive_conversation_sessions
  from public, anon, authenticated, service_role;

grant select, insert, update, delete
  on table public.adaptive_conversation_sessions
  to authenticated, service_role;
