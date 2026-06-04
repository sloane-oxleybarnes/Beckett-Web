create table if not exists public.course_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  course_id text not null,
  pre_confidence int check (pre_confidence between 1 and 5),
  post_confidence int check (post_confidence between 1 and 5),
  completed_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, course_id)
);

alter table public.course_completions enable row level security;

create policy "Users can manage own completions"
  on public.course_completions
  for all using (auth.uid() = user_id);
