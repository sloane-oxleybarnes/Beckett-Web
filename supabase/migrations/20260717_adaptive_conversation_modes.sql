-- Add optional simulation modes while keeping realistic as the default.
alter table public.adaptive_conversation_sessions
  drop constraint if exists adaptive_conversation_sessions_difficulty_check;

alter table public.adaptive_conversation_sessions
  add constraint adaptive_conversation_sessions_difficulty_check
  check (difficulty in ('realistic', 'supportive', 'challenging'));
