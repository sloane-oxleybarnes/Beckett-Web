create table if not exists public.slack_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  slack_team_id text not null,
  slack_user_id text not null,
  beckett_user_id uuid references auth.users(id) on delete set null,
  allowance_limit integer not null check (allowance_limit > 0),
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'released')),
  reserved_at timestamptz not null default now(),
  committed_at timestamptz,
  released_at timestamptz,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  unique (slack_team_id, slack_user_id, request_id),
  check (request_id ~ '^[A-Za-z0-9._:-]{1,255}$')
);

create index if not exists slack_credit_reservations_daily_idx
  on public.slack_credit_reservations (slack_team_id, slack_user_id, reserved_at desc);

alter table public.slack_credit_reservations enable row level security;
revoke all on table public.slack_credit_reservations from public, anon, authenticated;
grant select, insert, update, delete on table public.slack_credit_reservations to service_role;

create or replace function public.reserve_slack_credit(
  p_request_id text,
  p_slack_team_id text,
  p_slack_user_id text,
  p_beckett_user_id uuid,
  p_allowance_limit integer
) returns public.slack_credit_reservations
language plpgsql security invoker set search_path = public
as $$
declare
  existing public.slack_credit_reservations;
  active_count integer;
  shared_count integer;
  created public.slack_credit_reservations;
begin
  select * into existing from public.slack_credit_reservations
   where slack_team_id = p_slack_team_id and slack_user_id = p_slack_user_id and request_id = p_request_id;
  if found then return existing; end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_beckett_user_id::text, p_slack_team_id || ':' || p_slack_user_id), 0));
  update public.slack_credit_reservations set status = 'released', released_at = now()
   where status = 'reserved' and expires_at <= now();

  select count(*) into active_count from public.slack_credit_reservations
   where status = 'reserved' and expires_at > now() and reserved_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
     and ((p_beckett_user_id is not null and beckett_user_id = p_beckett_user_id)
       or (p_beckett_user_id is null and slack_team_id = p_slack_team_id and slack_user_id = p_slack_user_id));

  if p_beckett_user_id is not null then
    select coalesce(sum(credits), 0)::integer into shared_count from public.web_credit_events
     where user_id = p_beckett_user_id and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  else
    select coalesce(sum(credits_charged), 0)::integer into shared_count from public.slack_usage_events
     where slack_team_id = p_slack_team_id and slack_user_id = p_slack_user_id and success
       and occurred_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  end if;

  if active_count + shared_count >= p_allowance_limit then raise exception 'slack_credit_limit_reached' using errcode = 'P0001'; end if;

  insert into public.slack_credit_reservations(request_id, slack_team_id, slack_user_id, beckett_user_id, allowance_limit)
  values (p_request_id, p_slack_team_id, p_slack_user_id, p_beckett_user_id, p_allowance_limit)
  returning * into created;
  return created;
end $$;

create or replace function public.commit_slack_credit(p_reservation_id uuid, p_event_type text, p_flow_type text)
returns public.slack_credit_reservations language plpgsql security invoker set search_path = public as $$
declare reservation public.slack_credit_reservations;
begin
  select * into reservation from public.slack_credit_reservations where id = p_reservation_id for update;
  if not found then raise exception 'slack_credit_reservation_not_found'; end if;
  if reservation.status = 'committed' then return reservation; end if;
  if reservation.status <> 'reserved' or reservation.expires_at <= now() then raise exception 'slack_credit_reservation_inactive'; end if;

  update public.slack_credit_reservations set status='committed', committed_at=now() where id=p_reservation_id returning * into reservation;
  if reservation.beckett_user_id is not null then
    insert into public.web_credit_events(user_id, source, action, credits, metadata)
    values (reservation.beckett_user_id, 'slack', p_event_type, 1, jsonb_build_object('requestId', reservation.request_id));
  end if;
  insert into public.slack_usage_events(beckett_user_id, slack_team_id, slack_user_id, event_type, flow_type, request_id, credits_charged, success)
  values (reservation.beckett_user_id, reservation.slack_team_id, reservation.slack_user_id, p_event_type, p_flow_type, reservation.request_id, 1, true)
  on conflict do nothing;
  return reservation;
end $$;

create or replace function public.release_slack_credit(p_reservation_id uuid)
returns void language sql security invoker set search_path = public as $$
  update public.slack_credit_reservations set status='released', released_at=now()
  where id=p_reservation_id and status='reserved';
$$;

revoke all on function public.reserve_slack_credit(text,text,text,uuid,integer) from public, anon, authenticated;
revoke all on function public.commit_slack_credit(uuid,text,text) from public, anon, authenticated;
revoke all on function public.release_slack_credit(uuid) from public, anon, authenticated;
grant execute on function public.reserve_slack_credit(text,text,text,uuid,integer) to service_role;
grant execute on function public.commit_slack_credit(uuid,text,text) to service_role;
grant execute on function public.release_slack_credit(uuid) to service_role;

comment on table public.slack_credit_reservations is 'Content-free, idempotent Slack credit holds. Commit only after Slack accepts the user-visible response.';
