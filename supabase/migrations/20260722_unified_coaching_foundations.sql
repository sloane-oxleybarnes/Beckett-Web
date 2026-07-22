-- Shared, user-controlled foundations for personal coaching and the future desktop companion.
-- These additions do not change Slack or simulator behavior.

alter table public.contacts
  add column if not exists relationship_tags text[] not null default '{}';

alter table public.contacts
  add constraint contacts_relationship_tags_limit
  check (cardinality(relationship_tags) <= 12) not valid;

alter table public.contacts
  validate constraint contacts_relationship_tags_limit;

alter table public.profiles
  add column if not exists desktop_companion_enabled boolean not null default false,
  add column if not exists meeting_support_enabled boolean not null default false,
  add column if not exists meeting_prompt_style text not null default 'quiet'
    check (meeting_prompt_style in ('off', 'quiet', 'direct')),
  add column if not exists meeting_retention_preference text not null default 'summary_only'
    check (meeting_retention_preference in ('do_not_save', 'notes_only', 'summary_only')),
  add column if not exists meeting_consent_reminder_enabled boolean not null default true;
