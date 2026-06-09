alter table public.profiles
  add column if not exists extension_connected_at timestamptz;
