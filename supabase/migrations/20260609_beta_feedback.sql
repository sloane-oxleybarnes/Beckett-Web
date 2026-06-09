create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  rating text not null check (rating in ('yes', 'no')),
  comment text,
  platform text,
  mode text,
  source text,
  thread_count integer,
  sender text,
  sender_email text,
  response_text text,
  analysis_result jsonb not null default '{}'::jsonb,
  context_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;

create policy "Users can view own beta feedback"
  on public.beta_feedback for select
  using (auth.uid() = user_id);

create index if not exists beta_feedback_user_created_idx
  on public.beta_feedback (user_id, created_at desc);

create index if not exists beta_feedback_rating_created_idx
  on public.beta_feedback (rating, created_at desc);
