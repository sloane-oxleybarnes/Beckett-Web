create table if not exists public.site_content (
  key text primary key,
  value text not null default '',
  label text not null,
  section text not null default 'General',
  input_type text not null default 'text',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.site_content enable row level security;

create policy "Public can read site content"
  on public.site_content for select
  using (true);

create index if not exists site_content_section_idx
  on public.site_content (section, key);
