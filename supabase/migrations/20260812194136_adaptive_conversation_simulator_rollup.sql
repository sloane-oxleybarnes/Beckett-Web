-- Reconcile environments that predate the adaptive simulator migrations.
-- This is intentionally idempotent because production already has the table
-- while staging was missing it.
create table if not exists public.adaptive_conversation_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete set null,
  scenario_type text not null check (scenario_type in ('general', 'contact')),
  difficulty text not null default 'realistic' check (difficulty = 'realistic'),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  channel text not null default 'text' check (channel in ('text', 'phone', 'video')),
  lifecycle text not null default 'ready'
    check (lifecycle in ('setup', 'ready', 'responding', 'paused', 'help', 'completed', 'abandoned')),
  setup_snapshot jsonb not null default '{}'::jsonb,
  simulation_state jsonb not null default '{}'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  assessment jsonb,
  replay jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.adaptive_conversation_sessions
  add column if not exists channel text not null default 'text',
  add column if not exists lifecycle text not null default 'ready',
  add column if not exists replay jsonb;

update public.adaptive_conversation_sessions
set lifecycle = case
  when status = 'completed' then 'completed'
  when status = 'abandoned' then 'abandoned'
  else 'ready'
end
where lifecycle is null;

alter table public.adaptive_conversation_sessions
  drop constraint if exists adaptive_conversation_sessions_difficulty_check,
  drop constraint if exists adaptive_conversation_sessions_channel_check,
  drop constraint if exists adaptive_conversation_sessions_lifecycle_check;

alter table public.adaptive_conversation_sessions
  add constraint adaptive_conversation_sessions_difficulty_check
    check (difficulty in ('realistic', 'supportive', 'challenging')),
  add constraint adaptive_conversation_sessions_channel_check
    check (channel in ('text', 'phone', 'video')),
  add constraint adaptive_conversation_sessions_lifecycle_check
    check (lifecycle in ('setup', 'ready', 'responding', 'paused', 'help', 'completed', 'abandoned'));

create index if not exists adaptive_conversation_sessions_user_updated_idx
  on public.adaptive_conversation_sessions (user_id, updated_at desc);

create index if not exists adaptive_conversation_sessions_contact_id_idx
  on public.adaptive_conversation_sessions (contact_id);

alter table public.adaptive_conversation_sessions enable row level security;

drop policy if exists "Users manage own adaptive simulator sessions"
  on public.adaptive_conversation_sessions;

create policy "Users manage own adaptive simulator sessions"
  on public.adaptive_conversation_sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.adaptive_conversation_sessions from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.adaptive_conversation_sessions to authenticated;
grant select, insert, update, delete on table public.adaptive_conversation_sessions to service_role;

notify pgrst, 'reload schema';
