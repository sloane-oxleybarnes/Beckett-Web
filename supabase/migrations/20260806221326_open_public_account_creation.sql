-- Public Gmail Marketplace users must be able to create a Beckett account
-- without a prior beta approval. Keep the Auth hook installed so the access
-- policy can be tightened again later without reconfiguring Supabase Auth.

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

comment on function public.hook_require_approved_beta_signup(jsonb) is
  'Allows public account creation. The historical function name is retained because Supabase Auth calls this configured hook.';

grant execute
  on function public.hook_require_approved_beta_signup(jsonb)
  to supabase_auth_admin;

revoke execute
  on function public.hook_require_approved_beta_signup(jsonb)
  from anon, authenticated, public;
