create table if not exists public.workday_support_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  cue text not null check (char_length(cue) between 1 and 300),
  support_action text not null check (char_length(support_action) between 1 and 300),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workday_support_plans_user_updated_idx on public.workday_support_plans (user_id, updated_at desc);
grant select, insert, update, delete on public.workday_support_plans to authenticated;
alter table public.workday_support_plans enable row level security;
create policy "Users can read their own workday support plans" on public.workday_support_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own workday support plans" on public.workday_support_plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own workday support plans" on public.workday_support_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own workday support plans" on public.workday_support_plans for delete to authenticated using ((select auth.uid()) = user_id);
