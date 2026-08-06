import { NextRequest } from "next/server";
import { getMicrosoftProfile } from "@/lib/microsoft-oauth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/server-admin";

type OutlookAddinUser = { id: string };

/**
 * Authenticate an Outlook task-pane request without accepting a durable Beckett
 * credential from the browser. The short-lived Graph token is validated by
 * Microsoft Graph, then matched to the user's encrypted Microsoft connection.
 */
export async function getOutlookAddinUser(request: NextRequest): Promise<OutlookAddinUser | null> {
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const supabase = createSupabaseServerClient();
  const { data: { user: cookieUser } } = await supabase.auth.getUser();
  if (cookieUser) return { id: cookieUser.id };

  if (!bearerToken) return null;
  const { data: { user: beckettUser } } = await supabaseAdmin.auth.getUser(bearerToken);
  if (beckettUser) return { id: beckettUser.id };

  try {
    const profile = await getMicrosoftProfile(bearerToken);
    if (!profile.id) return null;
    const { data: integration, error } = await supabaseAdmin
      .from("user_integrations")
      .select("user_id")
      .eq("provider", "microsoft")
      .eq("external_user_id", profile.id)
      .maybeSingle();
    if (error || !integration?.user_id) return null;
    return { id: integration.user_id };
  } catch {
    return null;
  }
}
