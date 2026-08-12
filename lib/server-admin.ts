import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment } from "@/lib/server-env";

const supabaseEnvironment = getSupabaseAdminEnvironment();

export const supabaseAdmin = createClient(
  supabaseEnvironment.url,
  supabaseEnvironment.serviceRoleKey,
);
