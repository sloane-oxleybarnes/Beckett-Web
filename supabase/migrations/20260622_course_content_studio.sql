create table if not exists public.course_content (
  course_id text primary key,
  title text not null,
  section text not null default 'Professional',
  illustration text not null default 'clarity',
  is_listed boolean not null default true,
  sort_order integer not null default 100,
  source_course_id text,
  draft_json jsonb not null,
  published_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  updated_by uuid references auth.users(id)
);

alter table public.course_content enable row level security;

create index if not exists course_content_listed_idx
  on public.course_content (is_listed, section, sort_order, title);

create index if not exists course_content_published_idx
  on public.course_content (course_id)
  where published_json is not null;
