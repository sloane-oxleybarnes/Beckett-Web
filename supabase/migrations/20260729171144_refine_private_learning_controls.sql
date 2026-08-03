-- Staging-only refinement of private, consented learning.
-- Calendar context is stored only as schedule shape, never event titles, attendees,
-- messages, or other source content.

alter table public.profiles
  add column if not exists home_suggestions_enabled boolean not null default true,
  add column if not exists skill_recommendations_enabled boolean not null default false,
  add column if not exists meeting_prep_learning_enabled boolean not null default false;

alter table public.workday_checkins
  add column if not exists calendar_context jsonb not null default '{}'::jsonb;

alter table public.workday_support_actions
  add column if not exists remember_for_learning boolean not null default false;

alter table public.workday_pattern_summaries
  drop constraint if exists workday_pattern_summaries_status_check;

alter table public.workday_pattern_summaries
  add constraint workday_pattern_summaries_status_check
  check (status in ('proposed', 'remembered', 'dismissed', 'blocked'));
