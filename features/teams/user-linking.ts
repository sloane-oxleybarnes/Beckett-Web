export function matchesMicrosoftConnection(
  integration: { external_tenant_id?: string | null; external_user_id?: string | null },
  tenantId: string,
  aadObjectId: string,
) {
  return Boolean(
    tenantId.trim()
    && aadObjectId.trim()
    && integration.external_tenant_id === tenantId.trim()
    && integration.external_user_id === aadObjectId.trim(),
  );
}
