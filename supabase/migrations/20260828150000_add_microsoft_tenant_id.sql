alter table public.user_integrations
  add column if not exists external_tenant_id text;

create index if not exists user_integrations_microsoft_tenant_user_idx
  on public.user_integrations (external_tenant_id, external_user_id)
  where provider = 'microsoft';
