-- User-managed relationship tags. Existing contact context remains intact while
-- users can add reusable tags and choose the one Beckett uses for short labels.

alter table public.contacts
  add column if not exists primary_relationship_tag text;

update public.contacts
set relationship_tags = case
  when cardinality(relationship_tags) > 0 then relationship_tags
  when relationship_type = 'Manager' then array['manager']
  when relationship_type = 'Direct report' then array['direct_report']
  when relationship_type in ('Teammate', 'Cross-functional colleague') then array['colleague']
  when relationship_type = 'Client/customer' then array['client']
  when relationship_type = 'Vendor/partner' then array['partner']
  when relationship_type = 'Friend at work' then array['friend']
  when relationship_type = 'Other' and nullif(trim(relationship_other), '') is not null
    then array[lower(trim(relationship_other))]
  else '{}'::text[]
end
where cardinality(relationship_tags) = 0;

update public.contacts
set primary_relationship_tag = relationship_tags[1]
where primary_relationship_tag is null
  and cardinality(relationship_tags) > 0;

alter table public.contacts
  add constraint contacts_primary_relationship_tag_in_tags
  check (
    primary_relationship_tag is null
    or primary_relationship_tag = any(relationship_tags)
  ) not valid;

alter table public.contacts
  validate constraint contacts_primary_relationship_tag_in_tags;

create table if not exists public.relationship_tag_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_key text not null check (tag_key ~ '^[a-z0-9][a-z0-9 _-]{0,38}$'),
  label text not null check (char_length(trim(label)) between 1 and 39),
  created_at timestamptz not null default now(),
  unique (user_id, tag_key)
);

create index if not exists relationship_tag_definitions_user_id_idx
  on public.relationship_tag_definitions (user_id, label);

-- Preserve any custom tags users have already added through the earlier contact UI.
insert into public.relationship_tag_definitions (user_id, tag_key, label)
select distinct
  contacts.user_id,
  tag,
  initcap(replace(replace(tag, '_', ' '), '-', ' '))
from public.contacts
cross join lateral unnest(contacts.relationship_tags) as tag
where tag not in ('colleague', 'manager', 'direct_report', 'client', 'friend', 'family', 'roommate', 'dating', 'partner', 'mentor')
on conflict (user_id, tag_key) do nothing;

alter table public.relationship_tag_definitions enable row level security;

grant select, insert, update, delete on public.relationship_tag_definitions to authenticated;

create policy "Users manage their relationship tags"
  on public.relationship_tag_definitions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
