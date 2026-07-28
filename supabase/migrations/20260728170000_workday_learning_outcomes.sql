-- Staging-only foundations for consented workday learning.
-- Stores only structured choices and outcome ratings: never raw calendar events, messages, or notes.

alter table public.workday_pattern_summaries
  add column if not exists pattern_key text,
  add column if not exists status text not null default 'proposed',
  add column if not exists active boolean not null default true;

alter table public.workday_pattern_summaries
  drop constraint if exists workday_pattern_summaries_status_check;

alter table public.workday_pattern_summaries
  add constraint workday_pattern_summaries_status_check
  check (status in ('proposed', 'remembered', 'dismissed'));

update public.workday_pattern_summaries
set pattern_key = concat('legacy-', id::text)
where pattern_key is null;

alter table public.workday_pattern_summaries
  alter column pattern_key set not null;

create unique index if not exists workday_pattern_summaries_user_pattern_key_idx
  on public.workday_pattern_summaries(user_id, pattern_key);

create table if not exists public.workday_support_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_id uuid not null references public.workday_checkins(id) on delete cascade,
  action_type text not null check (action_type in ('short_walk', 'food_or_water', 'quiet_minutes', 'smaller_next_step', 'plan_priority', 'prepare_next', 'ask_for_time')),
  outcome text check (outcome in ('helped', 'a_little', 'not_helpful', 'skipped')),
  created_at timestamptz not null default now(),
  followed_up_at timestamptz
);

create index if not exists workday_support_actions_user_pending_idx
  on public.workday_support_actions(user_id, created_at desc)
  where outcome is null;

alter table public.workday_support_actions enable row level security;

drop policy if exists "Users can view their own workday support actions" on public.workday_support_actions;
create policy "Users can view their own workday support actions"
  on public.workday_support_actions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own workday support actions" on public.workday_support_actions;
create policy "Users can create their own workday support actions"
  on public.workday_support_actions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own workday support actions" on public.workday_support_actions;
create policy "Users can update their own workday support actions"
  on public.workday_support_actions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.workday_support_actions to authenticated;
