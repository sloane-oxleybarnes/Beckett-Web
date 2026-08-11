-- Complete the trusted_people -> contacts migration before removing the legacy
-- table. Preserve legacy-only relationship data and differing names when a
-- contact with the same ID already exists.
begin;

do $$
begin
  if exists (
    select 1
    from public.trusted_people tp
    join public.contacts c on c.id = tp.id
    where c.user_id is distinct from tp.user_id
  ) then
    raise exception 'Cannot consolidate trusted_people: a contact ID belongs to a different user';
  end if;
end
$$;

with legacy as (
  select
    id,
    user_id,
    name,
    nullif(relationship, '') as relationship,
    nullif(communication_style, '') as communication_style,
    nullif(notes, '') as notes,
    created_at,
    case lower(nullif(relationship, ''))
      when 'manager' then 'Manager'
      when 'direct report' then 'Direct report'
      when 'teammate' then 'Teammate'
      when 'cross-functional colleague' then 'Cross-functional colleague'
      when 'client/customer' then 'Client/customer'
      when 'vendor/partner' then 'Vendor/partner'
      when 'friend at work' then 'Friend at work'
      when 'other' then 'Other'
      else case when nullif(relationship, '') is not null then 'Other' end
    end as relationship_type,
    case
      when nullif(relationship, '') is not null
        and lower(relationship) not in (
          'manager',
          'direct report',
          'teammate',
          'cross-functional colleague',
          'client/customer',
          'vendor/partner',
          'friend at work',
          'other'
        )
      then relationship
    end as relationship_other
  from public.trusted_people
)
insert into public.contacts (
  id,
  user_id,
  name,
  notes,
  trusted,
  created_at,
  relationship_type,
  relationship_other
)
select
  id,
  user_id,
  name,
  concat_ws(E'\n', communication_style, notes),
  true,
  created_at,
  relationship_type,
  relationship_other
from legacy
on conflict (id) do nothing;

with legacy as (
  select
    tp.*,
    case lower(nullif(tp.relationship, ''))
      when 'manager' then 'Manager'
      when 'direct report' then 'Direct report'
      when 'teammate' then 'Teammate'
      when 'cross-functional colleague' then 'Cross-functional colleague'
      when 'client/customer' then 'Client/customer'
      when 'vendor/partner' then 'Vendor/partner'
      when 'friend at work' then 'Friend at work'
      when 'other' then 'Other'
      else case when nullif(tp.relationship, '') is not null then 'Other' end
    end as mapped_relationship_type,
    case
      when nullif(tp.relationship, '') is not null
        and lower(tp.relationship) not in (
          'manager',
          'direct report',
          'teammate',
          'cross-functional colleague',
          'client/customer',
          'vendor/partner',
          'friend at work',
          'other'
        )
      then tp.relationship
    end as mapped_relationship_other
  from public.trusted_people tp
)
update public.contacts c
set
  trusted = true,
  relationship_type = coalesce(c.relationship_type, l.mapped_relationship_type),
  relationship_other = case
    when c.relationship_type is null then l.mapped_relationship_other
    else c.relationship_other
  end,
  notes = concat_ws(
    E'\n',
    nullif(c.notes, ''),
    case
      when c.name is distinct from l.name
        and position(('Legacy contact name: ' || l.name) in coalesce(c.notes, '')) = 0
      then 'Legacy contact name: ' || l.name
    end,
    case
      when c.relationship_type is not null
        and nullif(l.relationship, '') is not null
        and l.relationship is distinct from case
          when c.relationship_type = 'Other' then c.relationship_other
          else c.relationship_type
        end
        and position(('Legacy relationship: ' || l.relationship) in coalesce(c.notes, '')) = 0
      then 'Legacy relationship: ' || l.relationship
    end,
    case
      when nullif(l.communication_style, '') is not null
        and position(l.communication_style in coalesce(c.notes, '')) = 0
      then l.communication_style
    end,
    case
      when nullif(l.notes, '') is not null
        and position(l.notes in coalesce(c.notes, '')) = 0
      then l.notes
    end
  )
from legacy l
where c.id = l.id;

drop table public.trusted_people;

commit;
