alter table public.contacts
  add column if not exists relationship_type text,
  add column if not exists relationship_other text;
