create table if not exists public.mobile_privacy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_processing_allowed boolean not null default false,
  ai_consent_version text,
  ai_consented_at timestamptz,
  retention_mode text not null default 'transient'
    check (retention_mode in ('transient', 'save_on_request')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (ai_processing_allowed and ai_consent_version is not null and ai_consented_at is not null)
    or
    (not ai_processing_allowed and ai_consent_version is null and ai_consented_at is null)
  )
);

alter table public.mobile_privacy_preferences enable row level security;

create policy "Users can view their mobile privacy preferences"
  on public.mobile_privacy_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their mobile privacy preferences"
  on public.mobile_privacy_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their mobile privacy preferences"
  on public.mobile_privacy_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.mobile_privacy_preferences from anon;
grant select, insert, update on table public.mobile_privacy_preferences to authenticated;
grant select, insert, update, delete on table public.mobile_privacy_preferences to service_role;

comment on table public.mobile_privacy_preferences is
  'Explicit iOS AI-processing consent and content-retention choice. Raw coaching content is not stored here.';
