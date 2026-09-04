-- Keep only the seven most recently active Practice conversations per user.
with ranked_sessions as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc, created_at desc, id desc
    ) as history_position
  from public.adaptive_conversation_sessions
)
delete from public.adaptive_conversation_sessions as session
using ranked_sessions
where session.id = ranked_sessions.id
  and ranked_sessions.history_position > 7;

create or replace function public.trim_adaptive_conversation_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serialize retention work for one user so simultaneous session creation
  -- cannot leave more than seven conversations behind.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  delete from public.adaptive_conversation_sessions
  where id in (
    select id
    from public.adaptive_conversation_sessions
    where user_id = new.user_id
    order by updated_at desc, created_at desc, id desc
    offset 7
  );

  return new;
end;
$$;

drop trigger if exists trim_adaptive_conversation_history_after_insert
  on public.adaptive_conversation_sessions;

create trigger trim_adaptive_conversation_history_after_insert
after insert on public.adaptive_conversation_sessions
for each row
execute function public.trim_adaptive_conversation_history();
