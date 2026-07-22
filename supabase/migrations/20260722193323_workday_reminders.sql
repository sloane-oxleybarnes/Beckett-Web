create table if not exists public.workday_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Workday check-in' check (char_length(title) between 1 and 120),
  reminder_time time not null,
  days_of_week smallint[] not null default '{1,2,3,4,5}' check (
    cardinality(days_of_week) between 1 and 7
    and days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workday_reminders_user_active_idx
  on public.workday_reminders (user_id, active);

alter table public.workday_reminders enable row level security;

create policy "Users can view their own workday reminders"
  on public.workday_reminders for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own workday reminders"
  on public.workday_reminders for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own workday reminders"
  on public.workday_reminders for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own workday reminders"
  on public.workday_reminders for delete to authenticated
  using ((select auth.uid()) = user_id);
