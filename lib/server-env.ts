import "server-only";

import { requireEnvValue, requireHttpUrl } from "@/lib/env-validation";

export function getSupabaseAdminEnvironment() {
  return {
    url: requireHttpUrl(process.env, "NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: requireEnvValue(process.env, "SUPABASE_SERVICE_ROLE_KEY"),
  };
}
