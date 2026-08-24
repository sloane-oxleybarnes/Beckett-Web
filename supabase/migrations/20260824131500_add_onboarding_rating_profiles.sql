alter table public.profiles
  add column if not exists communication_strength_ratings jsonb not null default '{}'::jsonb,
  add column if not exists workplace_effort_ratings jsonb not null default '{}'::jsonb,
  add column if not exists coaching_priority_ratings jsonb not null default '{}'::jsonb,
  add column if not exists coaching_style_ratings jsonb not null default '{}'::jsonb;

comment on column public.profiles.communication_strength_ratings is
  'Self-ratings for each onboarding communication strength category.';
comment on column public.profiles.workplace_effort_ratings is
  'Extra-effort ratings for each onboarding workplace situation.';
comment on column public.profiles.coaching_priority_ratings is
  'Usefulness ratings for each onboarding coaching-support area.';
comment on column public.profiles.coaching_style_ratings is
  'Independent ratings for coaching style qualities.';
