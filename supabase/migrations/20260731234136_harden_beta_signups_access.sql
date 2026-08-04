begin;

drop policy if exists "Allow anonymous inserts" on public.beta_signups;

revoke all privileges on table public.beta_signups from anon, authenticated;

commit;
