alter table public.meeting_sessions
  add column if not exists pre_meeting_goals jsonb not null default '[]'::jsonb,
  add column if not exists attendee_context text,
  add column if not exists communication_reminders text,
  add column if not exists prep_checklist jsonb not null default '[]'::jsonb;
