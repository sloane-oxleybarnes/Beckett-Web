-- Public signup is open. The first 100 profiles receive beta access; all
-- later profiles receive Free. The advisory lock makes the allocation atomic.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  beta_users integer;
  assigned_plan text;
begin
  perform pg_advisory_xact_lock(7261001);
  select count(*)::integer into beta_users from public.profiles where plan = 'beta';
  assigned_plan := case when beta_users < 100 then 'beta' else 'free' end;

  insert into public.profiles (id, email, full_name, plan)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', assigned_plan);
  return new;
end;
$$;

-- This hook may remain configured in Supabase Auth, but it must no longer
-- deny account creation now that signup is public.
create or replace function public.hook_require_approved_beta_signup(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  return '{}'::jsonb;
end;
$$;

-- A browser user may update their own profile, but cannot promote their plan.
create or replace function public.prevent_profile_plan_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.plan is distinct from old.plan and auth.uid() = old.id then
    raise exception 'Plan changes are managed by Beckett.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_plan_self_promotion on public.profiles;
create trigger prevent_profile_plan_self_promotion
  before update on public.profiles
  for each row execute function public.prevent_profile_plan_self_promotion();

revoke execute on function public.prevent_profile_plan_self_promotion() from public, anon, authenticated;
