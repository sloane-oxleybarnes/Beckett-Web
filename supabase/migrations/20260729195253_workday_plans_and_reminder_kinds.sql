-- Staging-only additions for user-controlled, daily planning.
-- A daily focus is intentionally short-lived and belongs only to the user.

alter table public.workday_reminders
  add column if not exists reminder_kind text not null default 'check_in';

alter table public.workday_reminders
  drop constraint if exists workday_reminders_kind_check;

alter table public.workday_reminders
  add constraint workday_reminders_kind_check
  check (reminder_kind in ('check_in', 'reset', 'review_plan'));

create table if not exists public.workday_day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null default current_date,
  focus text not null check (char_length(focus) between 1 and 160),
  next_step text not null default '' check (char_length(next_step) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

create index if not exists workday_day_plans_user_date_idx
  on public.workday_day_plans (user_id, plan_date desc);

alter table public.workday_day_plans enable row level security;

create policy "Users can view their own workday day plans"
  on public.workday_day_plans for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own workday day plans"
  on public.workday_day_plans for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own workday day plans"
  on public.workday_day_plans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own workday day plans"
  on public.workday_day_plans for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.workday_day_plans to authenticated;
