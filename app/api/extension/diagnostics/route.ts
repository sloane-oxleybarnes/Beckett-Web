import { NextResponse } from "next/server";
import { getAiUsageToday, getDailyAiLimit, isUnlimitedAiUser, UNLIMITED_AI_LIMIT } from "@/lib/ai-usage";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";
import { loadSlackConnectionsForUser } from "@/lib/slack-connections-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const [{ data: profile }, { data: integrations }, slackResult, used] = await Promise.all([
    integrationsRepository
      .from("profiles")
      .select("id, email, plan, extension_token, extension_connected_at, updated_at")
      .eq("id", userId)
      .single(),
    integrationsRepository
      .from("user_integrations")
      .select("provider, external_user_id, external_team_id, external_team_name, metadata, connected_at, updated_at")
      .eq("user_id", userId),
    loadSlackConnectionsForUser(userId),
    getAiUsageToday(userId),
  ]);

  const unlimited = await isUnlimitedAiUser(userId);
  const limit = unlimited ? UNLIMITED_AI_LIMIT : getDailyAiLimit();
  const slackConnections = slackResult.connections;
  const primarySlack = slackConnections[0] || null;
  const google = integrations?.find((item) => item.provider === "google_workspace_addon");
  const microsoft = integrations?.find((item) => item.provider === "microsoft");

  return NextResponse.json({
    beckett: {
      authenticated: true,
      email: profile?.email || user.email || null,
      plan: profile?.plan || "free",
    },
    extension: {
      tokenIssued: Boolean(profile?.extension_token),
      lastProfileSyncAt: profile?.extension_connected_at || profile?.updated_at || null,
    },
    integrations: {
      slack: {
        connected: slackConnections.some((connection) => connection.state === "active"),
        state: primarySlack?.state || "disconnected",
        userId: primarySlack?.userId || null,
        teamId: primarySlack?.teamId || null,
        teamName: primarySlack?.teamName || null,
        connectedAt: primarySlack?.connectedAt || null,
        updatedAt: primarySlack?.updatedAt || null,
        connections: slackConnections,
      },
      google: google
        ? {
            connected: true,
            email:
              (google.metadata && typeof google.metadata === "object" && "email" in google.metadata
                ? String(google.metadata.email)
                : null),
            connectedAt: google.connected_at || null,
            updatedAt: google.updated_at || null,
          }
        : { connected: false },
      microsoft: microsoft
        ? {
            connected: true,
            email:
              (microsoft.metadata && typeof microsoft.metadata === "object" && "email" in microsoft.metadata
                ? String(microsoft.metadata.email)
                : microsoft.external_user_id || null),
            connectedAt: microsoft.connected_at || null,
            updatedAt: microsoft.updated_at || null,
          }
        : { connected: false },
    },
    aiUsage: {
      limit,
      used,
      remaining: unlimited ? UNLIMITED_AI_LIMIT : Math.max(limit - used, 0),
      unlimited,
    },
    api: {
      reachable: true,
      checkedAt: new Date().toISOString(),
    },
  });
}
