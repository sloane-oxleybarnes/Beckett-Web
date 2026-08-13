import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/server-admin";

/**
 * The service-role client is intentionally constructed in one place. Domain
 * repositories are the only application-facing exports; route handlers should
 * use their domain repository instead of importing the privileged client.
 */
type PrivilegedRepository = SupabaseClient;

function createRepository(): PrivilegedRepository {
  return supabaseAdmin;
}

export const contactsRepository = createRepository();
export const integrationsRepository = createRepository();
export const learningRepository = createRepository();
export const slackRepository = createRepository();
export const workdayRepository = createRepository();

/** Transitional boundary for admin, feedback, and other platform-owned data. */
export const platformRepository = createRepository();
