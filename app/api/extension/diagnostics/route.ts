import { NextResponse } from "next/server";
import { getAiUsageToday, getDailyAiLimit, isUnlimitedAiUser, UNLIMITED_AI_LIMIT } from "@/lib/ai-usage";
import { supabaseAdmin } from "@/lib/server-admin";
import { getAuthenticatedContext } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getAuthenticatedContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const [{ data: profile }, { data: integrations }, used] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, email, plan, extension_token, extension_connected_at, updated_at")
      .eq("id", userId)
      .single(),
    supabaseAdmin
      .from("user_integrations")
      .select("provider, external_user_id, external_team_id, external_team_name, metadata, connected_at, updated_at")
      .eq("user_id", userId),
    getAiUsageToday(userId),
  ]);

  const unlimited = await isUnlimitedAiUser(userId);
  const limit = unlimited ? UNLIMITED_AI_LIMIT : getDailyAiLimit();
  const slack = integrations?.find((item) => item.provider === "slack");
  const google = integrations?.find((item) => item.provider === "google");
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
      slack: slack
        ? {
            connected: true,
            userId: slack.external_user_id || null,
            teamId: slack.external_team_id || null,
            teamName: slack.external_team_name || null,
            connectedAt: slack.connected_at || null,
            updatedAt: slack.updated_at || null,
          }
        : { connected: false },
      google: google
        ? {
            connected: true,
            email:
              google.external_user_id ||
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
              microsoft.external_user_id ||
              (microsoft.metadata && typeof microsoft.metadata === "object" && "email" in microsoft.metadata
                ? String(microsoft.metadata.email)
                : null),
            connectedAt: microsoft.connected_at || null,
            updatedAt: microsoft.updated_at || null,
            scopes:
              microsoft.metadata && typeof microsoft.metadata === "object" && "scopes" in microsoft.metadata
                ? String(microsoft.metadata.scopes)
                : null,
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
