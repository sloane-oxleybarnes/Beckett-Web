create table public.web_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  action text not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released')),
  metadata jsonb not null default '{}'::jsonb,
  reserved_at timestamptz not null default now(),
  committed_at timestamptz,
  released_at timestamptz,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  unique (user_id, request_id),
  check (request_id ~ '^[A-Za-z0-9._:-]{1,255}$')
);

create index web_credit_reservations_user_reserved_idx
  on public.web_credit_reservations (user_id, reserved_at desc)
  where status = 'reserved';

alter table public.web_credit_reservations enable row level security;
revoke all on table public.web_credit_reservations from public, anon, authenticated;
grant select, insert, update, delete on table public.web_credit_reservations to service_role;

create or replace function public.consume_ai_usage(
  p_user_id uuid,
  p_source text,
  p_action text,
  p_token_estimate integer,
  p_metadata jsonb,
  p_limit integer
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  used integer;
  is_course boolean := p_source = 'course';
begin
  if p_limit <= 0 then
    raise exception 'ai_usage_invalid_limit' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || case when is_course then 'course' else 'analysis' end, 0)
  );

  select count(*)::integer into used
  from public.ai_usage_events
  where user_id = p_user_id
    and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
    and (case when is_course then source = 'course' else source <> 'course' end);

  if used >= p_limit then
    raise exception 'ai_usage_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.ai_usage_events(user_id, source, action, token_estimate, metadata)
  values (
    p_user_id,
    p_source,
    p_action,
    greatest(coalesce(p_token_estimate, 1), 1),
    coalesce(p_metadata, '{}'::jsonb)
  );

  return used + 1;
end;
$$;

create or replace function public.reserve_web_credit(
  p_request_id text,
  p_user_id uuid,
  p_source text,
  p_action text,
  p_metadata jsonb,
  p_daily_limit integer,
  p_monthly_limit integer
) returns public.web_credit_reservations
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing public.web_credit_reservations;
  daily_used integer;
  monthly_used integer;
  daily_reserved integer;
  monthly_reserved integer;
  created public.web_credit_reservations;
begin
  select * into existing
  from public.web_credit_reservations
  where user_id = p_user_id and request_id = p_request_id;
  if found then return existing; end if;

  if p_daily_limit <= 0 or p_monthly_limit <= 0 then
    raise exception 'web_credit_invalid_limit' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  update public.web_credit_reservations
  set status = 'released', released_at = now()
  where user_id = p_user_id and status = 'reserved' and expires_at <= now();

  select coalesce(sum(credits), 0)::integer into daily_used
  from public.web_credit_events
  where user_id = p_user_id
    and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';

  select coalesce(sum(credits), 0)::integer into monthly_used
  from public.web_credit_events
  where user_id = p_user_id
    and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';

  select count(*)::integer into daily_reserved
  from public.web_credit_reservations
  where user_id = p_user_id and status = 'reserved' and expires_at > now()
    and reserved_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';

  select count(*)::integer into monthly_reserved
  from public.web_credit_reservations
  where user_id = p_user_id and status = 'reserved' and expires_at > now()
    and reserved_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';

  if daily_used + daily_reserved >= p_daily_limit then
    raise exception 'web_credit_daily_limit_reached' using errcode = 'P0001';
  end if;
  if monthly_used + monthly_reserved >= p_monthly_limit then
    raise exception 'web_credit_monthly_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.web_credit_reservations(
    request_id, user_id, source, action, metadata
  ) values (
    p_request_id, p_user_id, p_source, p_action, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into created;

  return created;
end;
$$;

create or replace function public.commit_web_credit(p_reservation_id uuid)
returns public.web_credit_reservations
language plpgsql
security invoker
set search_path = public
as $$
declare
  reservation public.web_credit_reservations;
begin
  select * into reservation
  from public.web_credit_reservations
  where id = p_reservation_id
  for update;

  if not found then raise exception 'web_credit_reservation_not_found'; end if;
  if reservation.status = 'committed' then return reservation; end if;
  if reservation.status <> 'reserved' or reservation.expires_at <= now() then
    raise exception 'web_credit_reservation_inactive';
  end if;

  update public.web_credit_reservations
  set status = 'committed', committed_at = now()
  where id = p_reservation_id
  returning * into reservation;

  insert into public.web_credit_events(user_id, source, action, credits, metadata)
  values (reservation.user_id, reservation.source, reservation.action, 1, reservation.metadata);

  return reservation;
end;
$$;

create or replace function public.release_web_credit(p_reservation_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.web_credit_reservations
  set status = 'released', released_at = now()
  where id = p_reservation_id and status = 'reserved';
$$;

create or replace function public.ensure_web_course_access(
  p_user_id uuid,
  p_course_id text,
  p_period_start date,
  p_limit integer
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':courses', 0));

  if exists (
    select 1 from public.web_course_unlocks
    where user_id = p_user_id and course_id = p_course_id and period_start = p_period_start
  ) then
    return true;
  end if;

  select count(*)::integer into used
  from public.web_course_unlocks
  where user_id = p_user_id and period_start = p_period_start;

  if used >= p_limit then
    raise exception 'web_course_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.web_course_unlocks(user_id, course_id, period_start)
  values (p_user_id, p_course_id, p_period_start);
  return true;
end;
$$;

revoke all on function public.consume_ai_usage(uuid,text,text,integer,jsonb,integer) from public, anon, authenticated;
revoke all on function public.reserve_web_credit(text,uuid,text,text,jsonb,integer,integer) from public, anon, authenticated;
revoke all on function public.commit_web_credit(uuid) from public, anon, authenticated;
revoke all on function public.release_web_credit(uuid) from public, anon, authenticated;
revoke all on function public.ensure_web_course_access(uuid,text,date,integer) from public, anon, authenticated;
grant execute on function public.consume_ai_usage(uuid,text,text,integer,jsonb,integer) to service_role;
grant execute on function public.reserve_web_credit(text,uuid,text,text,jsonb,integer,integer) to service_role;
grant execute on function public.commit_web_credit(uuid) to service_role;
grant execute on function public.release_web_credit(uuid) to service_role;
grant execute on function public.ensure_web_course_access(uuid,text,date,integer) to service_role;
