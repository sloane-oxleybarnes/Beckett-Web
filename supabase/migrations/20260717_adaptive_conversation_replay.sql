-- Store one replay branch alongside the original session transcript.
alter table public.adaptive_conversation_sessions
  add column if not exists replay jsonb;
