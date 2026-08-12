create table if not exists public.microsoft_subscriptions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('calendar', 'mail')),
  resource text not null,
  expiration_at timestamptz not null,
  client_state_hash text not null,
  last_notification_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists microsoft_subscriptions_user_id_idx
  on public.microsoft_subscriptions(user_id);

alter table public.microsoft_subscriptions enable row level security;

revoke all on table public.microsoft_subscriptions from anon, authenticated;
