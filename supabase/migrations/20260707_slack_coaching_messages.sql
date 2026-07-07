create table if not exists public.slack_coaching_messages (
  id uuid primary key default gen_random_uuid(),
  coaching_thread_id uuid references public.slack_coaching_threads(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  slack_team_id text not null,
  slack_user_id text not null,
  role text not null check (role in ('user', 'beckett')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists slack_coaching_messages_thread_created_idx
  on public.slack_coaching_messages (coaching_thread_id, created_at asc);

create index if not exists slack_coaching_messages_user_recent_idx
  on public.slack_coaching_messages (user_id, created_at desc);

alter table public.slack_coaching_messages enable row level security;

create policy "Users can manage own Slack coaching messages"
  on public.slack_coaching_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
