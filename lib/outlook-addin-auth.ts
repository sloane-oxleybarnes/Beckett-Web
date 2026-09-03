import { NextRequest } from "next/server";
import { getMicrosoftProfile } from "@/lib/microsoft-oauth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";

type OutlookAddinUser = { id: string };

/**
 * Authenticate an Outlook task-pane request without accepting a durable Beckett
 * credential from the browser. The short-lived Graph token is validated by
 * Microsoft Graph, then matched to the user's encrypted Microsoft connection.
 */
export async function getOutlookAddinUser(request: NextRequest): Promise<OutlookAddinUser | null> {
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const supabase = await createSupabaseServerClient();
  const { data: { user: cookieUser } } = await supabase.auth.getUser();
  if (cookieUser) return { id: cookieUser.id };

  if (!bearerToken) return null;
  const { data: { user: beckettUser } } = await integrationsRepository.auth.getUser(bearerToken);
  if (beckettUser) return { id: beckettUser.id };

  try {
    const profile = await getMicrosoftProfile(bearerToken);
    if (!profile.id) return null;
    const { data: integration, error } = await integrationsRepository
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

/**
 * Determines whether a valid Microsoft token belongs to a Microsoft account
 * that has not yet been linked to a Beckett profile. The pane uses this to
 * show a recoverable connection prompt instead of treating the user as signed
 * out of Microsoft.
 */
export async function hasUnlinkedMicrosoftAccount(request: NextRequest): Promise<boolean> {
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!bearerToken) return false;
  try {
    const profile = await getMicrosoftProfile(bearerToken);
    if (!profile.id) return false;
    const { data: integration, error } = await integrationsRepository
      .from("user_integrations")
      .select("user_id")
      .eq("provider", "microsoft")
      .eq("external_user_id", profile.id)
      .maybeSingle();
    return !error && !integration?.user_id;
  } catch {
    return false;
  }
}
