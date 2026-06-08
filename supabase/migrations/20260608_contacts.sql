-- Contacts table
create table if not exists public.contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text,
  slack_handle text,
  phone_number text,
  notes text,
  trusted boolean default false not null,
  created_at timestamptz default now()
);

-- Contact identifiers — links one contact to multiple platform handles
create table if not exists public.contact_identifiers (
  id uuid default gen_random_uuid() primary key,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  platform text not null,    -- 'email', 'slack', 'phone', 'linkedin'
  identifier text not null,  -- lowercased value
  created_at timestamptz default now(),
  unique(user_id, platform, identifier)
);

-- AI-generated relationship insights
create table if not exists public.contact_insights (
  id uuid default gen_random_uuid() primary key,
  contact_id uuid references public.contacts(id) on delete cascade unique not null,
  summary text,
  communication_patterns text,
  common_topics text,
  tone_trend text,
  responsiveness text,
  generated_at timestamptz default now()
);

-- RLS
alter table public.contacts enable row level security;
alter table public.contact_identifiers enable row level security;
alter table public.contact_insights enable row level security;

create policy "Users manage own contacts"
  on public.contacts for all using (auth.uid() = user_id);

create policy "Users manage own contact identifiers"
  on public.contact_identifiers for all using (auth.uid() = user_id);

create policy "Users manage own contact insights"
  on public.contact_insights for all
  using (exists (
    select 1 from public.contacts c
    where c.id = contact_id and c.user_id = auth.uid()
  ));

-- Migrate existing trusted_people rows into contacts
insert into public.contacts (id, user_id, name, notes, trusted, created_at)
select
  id,
  user_id,
  name,
  concat_ws(E'\n', nullif(relationship, ''), nullif(communication_style, ''), nullif(notes, '')),
  true,
  created_at
from public.trusted_people
on conflict do nothing;

-- Per-user extension auth token
alter table public.profiles add column if not exists extension_token uuid default gen_random_uuid();
