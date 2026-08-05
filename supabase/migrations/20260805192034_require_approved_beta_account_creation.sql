-- Prevent every account-creation path, including OAuth, until the email has
-- an approved Beckett beta signup. Existing auth users are unaffected because
-- the hook runs only before a new auth.users row is inserted.

create index if not exists beta_signups_approved_email_idx
  on public.beta_signups (lower(email))
  where approved is true;

create or replace function public.hook_require_approved_beta_signup(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  signup_email text := lower(btrim(event->'user'->>'email'));
begin
  if signup_email is not null
    and signup_email <> ''
    and exists (
      select 1
      from public.beta_signups
      where lower(email) = signup_email
        and approved is true
    )
  then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Beta approval is required before creating a Beckett account.'
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant select (email, approved) on table public.beta_signups to supabase_auth_admin;

drop policy if exists "Auth hook can read approved beta signups" on public.beta_signups;
create policy "Auth hook can read approved beta signups"
  on public.beta_signups
  for select
  to supabase_auth_admin
  using (approved is true);

grant execute
  on function public.hook_require_approved_beta_signup(jsonb)
  to supabase_auth_admin;

revoke execute
  on function public.hook_require_approved_beta_signup(jsonb)
  from anon, authenticated, public;
