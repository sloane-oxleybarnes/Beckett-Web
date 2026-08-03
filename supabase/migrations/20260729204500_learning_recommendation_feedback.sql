-- Staging-only feedback for consented, earned learning recommendations.
-- This stores only the user's explicit save/dismiss choice and the safe,
-- deterministic recommendation metadata shown to them. It never stores raw
-- Gmail, Calendar, Slack, or Practice conversation content.

create table if not exists public.learning_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_key text not null check (char_length(recommendation_key) between 1 and 120),
  status text not null check (status in ('saved', 'dismissed')),
  title text not null check (char_length(title) between 1 and 200),
  href text not null check (char_length(href) between 1 and 500),
  reason text not null check (char_length(reason) between 1 and 500),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recommendation_key)
);

create index if not exists learning_recommendation_feedback_user_updated_idx
  on public.learning_recommendation_feedback (user_id, updated_at desc);

alter table public.learning_recommendation_feedback enable row level security;

create policy "Users can view their own learning recommendation feedback"
  on public.learning_recommendation_feedback for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own learning recommendation feedback"
  on public.learning_recommendation_feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own learning recommendation feedback"
  on public.learning_recommendation_feedback for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own learning recommendation feedback"
  on public.learning_recommendation_feedback for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.learning_recommendation_feedback to authenticated;
