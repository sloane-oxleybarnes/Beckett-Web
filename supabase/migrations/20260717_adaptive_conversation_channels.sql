-- Add shared interaction channels so text, phone, and future video use one session model.
alter table public.adaptive_conversation_sessions
  add column if not exists channel text not null default 'text';

alter table public.adaptive_conversation_sessions
  drop constraint if exists adaptive_conversation_sessions_channel_check;

alter table public.adaptive_conversation_sessions
  add constraint adaptive_conversation_sessions_channel_check
  check (channel in ('text', 'phone', 'video'));
