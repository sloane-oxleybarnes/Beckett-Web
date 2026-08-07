create table if not exists public.user_app_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null check (app_id in ('gmail', 'google_calendar', 'slack', 'outlook', 'microsoft_calendar', 'chrome')),
  added_source text not null default 'apps_page' check (added_source in ('onboarding', 'connection', 'apps_page', 'backfill')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

alter table public.user_app_preferences enable row level security;

create policy "Users can view their own app preferences"
  on public.user_app_preferences for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can add their own app preferences"
  on public.user_app_preferences for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own app preferences"
  on public.user_app_preferences for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can remove their own app preferences"
  on public.user_app_preferences for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.user_app_preferences from anon;
grant select, insert, update, delete on table public.user_app_preferences to authenticated;

insert into public.user_app_preferences (user_id, app_id, added_source)
select distinct user_id, app_id, 'backfill'
from (
  select user_id,
    case provider
      when 'google' then 'gmail'
      when 'google_workspace_addon' then 'gmail'
      when 'google_calendar' then 'google_calendar'
      when 'slack' then 'slack'
      when 'microsoft' then 'outlook'
    end as app_id
  from public.user_integrations
  where provider in ('google', 'google_workspace_addon', 'google_calendar', 'slack', 'microsoft')
  union all
  select user_id, 'microsoft_calendar'
  from public.user_integrations
  where provider = 'microsoft'
  union all
  select id, 'chrome'
  from public.profiles
  where extension_connected_at is not null
) existing_apps
where app_id is not null
on conflict (user_id, app_id) do nothing;

