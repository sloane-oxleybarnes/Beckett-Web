-- Read plan from user metadata when creating profile (e.g. beta invites pass data: { plan: 'beta' })
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, plan)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'plan', 'free')
  );
  return new;
end;
$$ language plpgsql security definer;
