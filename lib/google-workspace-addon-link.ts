import type { NextRequest } from "next/server";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";
import {
  createWorkspaceAddOnLinkToken,
  hashWorkspaceAddOnLinkToken,
  isWorkspaceAddOnLinkToken,
} from "@/lib/google-workspace-addon-link-token";
import {
  endpointUrl,
  type WorkspaceAddOnEvent,
  verifyWorkspaceAddOnUser,
} from "@/lib/google-workspace-addon";

const LINK_LIFETIME_MS = 30 * 60 * 1_000;

type LinkSessionRow = {
  id: string;
  google_subject: string;
  google_email: string;
  expires_at: string;
};

export async function createWorkspaceAddOnConnectUrl(
  request: NextRequest,
  event: WorkspaceAddOnEvent,
) {
  const user = await verifyWorkspaceAddOnUser(event);
  const token = createWorkspaceAddOnLinkToken();
  const now = new Date();

  await integrationsRepository
    .from("google_workspace_addon_link_sessions")
    .delete()
    .lt("expires_at", now.toISOString());

  const { error } = await integrationsRepository.from("google_workspace_addon_link_sessions").insert({
    token_hash: hashWorkspaceAddOnLinkToken(token),
    google_subject: user.sub,
    google_email: user.email!.trim().toLowerCase(),
    expires_at: new Date(now.getTime() + LINK_LIFETIME_MS).toISOString(),
  });
  if (error) throw error;

  return endpointUrl(
    request,
    `/auth/google-workspace-addon/connect?token=${encodeURIComponent(token)}`,
  );
}

export async function getWorkspaceAddOnLinkSession(token: string) {
  if (!isWorkspaceAddOnLinkToken(token)) return null;

  const { data, error } = await integrationsRepository
    .from("google_workspace_addon_link_sessions")
    .select("id,google_subject,google_email,expires_at")
    .eq("token_hash", hashWorkspaceAddOnLinkToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return (data as LinkSessionRow | null) || null;
}

export async function connectWorkspaceAddOnAccount({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) {
  const session = await getWorkspaceAddOnLinkSession(token);
  if (!session) return { ok: false as const, error: "link_expired" };

  const { data: existingSubject } = await integrationsRepository
    .from("user_integrations")
    .select("user_id")
    .eq("provider", "google_workspace_addon")
    .eq("external_user_id", session.google_subject)
    .maybeSingle();
  if (existingSubject?.user_id && existingSubject.user_id !== userId) {
    return { ok: false as const, error: "google_account_already_linked" };
  }

  const now = new Date().toISOString();
  const { error } = await integrationsRepository.from("user_integrations").upsert(
    {
      user_id: userId,
      provider: "google_workspace_addon",
      external_user_id: session.google_subject,
      metadata: {
        email: session.google_email,
        source: "google_workspace_addon_explicit_link",
      },
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw error;

  await integrationsRepository
    .from("user_integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google_workspace_addon_disabled")
    .eq("external_user_id", session.google_subject);

  await integrationsRepository
    .from("google_workspace_addon_link_sessions")
    .delete()
    .eq("id", session.id);

  return { ok: true as const, googleEmail: session.google_email };
}
