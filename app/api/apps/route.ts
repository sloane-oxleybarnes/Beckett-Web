import { NextRequest, NextResponse } from "next/server";
import { CONNECTED_APP_IDS, isConnectedAppId, type ConnectedAppId } from "@/lib/connected-apps";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";
import { loadSlackConnectionsForUser } from "@/lib/slack-connections-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function currentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const [{ data: preferences, error: preferenceError }, { data: integrations, error: integrationError }, { data: profile, error: profileError }, slackResult] = await Promise.all([
    integrationsRepository.from("user_app_preferences").select("app_id").eq("user_id", user.id),
    integrationsRepository.from("user_integrations").select("provider, external_user_id, external_team_name, metadata").eq("user_id", user.id),
    integrationsRepository.from("profiles").select("extension_connected_at").eq("id", user.id).maybeSingle(),
    loadSlackConnectionsForUser(user.id),
  ]);

  if (preferenceError || integrationError || profileError) {
    return NextResponse.json({ error: "Could not load your apps." }, { status: 500 });
  }

  const providers = new Map((integrations || []).map((item) => [item.provider, item]));
  const microsoft = providers.get("microsoft");
  const google = providers.get("google") || providers.get("google_workspace_addon");
  const connected: Record<ConnectedAppId, boolean> = {
    gmail: Boolean(google),
    google_calendar: providers.has("google_calendar"),
    slack: slackResult.summary.connected,
    outlook: Boolean(microsoft),
    microsoft_calendar: Boolean(microsoft),
    chrome: Boolean(profile?.extension_connected_at),
  };
  const details: Partial<Record<ConnectedAppId, string>> = {
    gmail: google?.external_user_id || undefined,
    slack: slackResult.summary.label,
    outlook: microsoft?.external_user_id || undefined,
    microsoft_calendar: microsoft?.external_user_id || undefined,
  };
  const selectedAppIds = new Set((preferences || []).map((item) => item.app_id).filter(isConnectedAppId));
  const newlyConnected = CONNECTED_APP_IDS.filter((appId) => connected[appId] && !selectedAppIds.has(appId));
  if (newlyConnected.length) {
    await integrationsRepository.from("user_app_preferences").upsert(
      newlyConnected.map((appId) => ({ user_id: user.id, app_id: appId, added_source: "connection" })),
      { onConflict: "user_id,app_id" },
    );
    newlyConnected.forEach((appId) => selectedAppIds.add(appId));
  }

  return NextResponse.json({
    selectedAppIds: CONNECTED_APP_IDS.filter((appId) => selectedAppIds.has(appId)),
    connected,
    details,
    slack: slackResult,
  });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { appIds?: unknown; source?: unknown } | null;
  const appIds = Array.isArray(body?.appIds) ? body.appIds.filter(isConnectedAppId) : [];
  if (!appIds.length) return NextResponse.json({ error: "Choose at least one supported app." }, { status: 400 });
  const source = body?.source === "onboarding" || body?.source === "connection" ? body.source : "apps_page";
  const now = new Date().toISOString();
  const { error } = await integrationsRepository.from("user_app_preferences").upsert(
    Array.from(new Set(appIds)).map((appId) => ({ user_id: user.id, app_id: appId, added_source: source, updated_at: now })),
    { onConflict: "user_id,app_id" },
  );
  if (error) return NextResponse.json({ error: "Could not update your apps." }, { status: 500 });
  return NextResponse.json({ ok: true, appIds: CONNECTED_APP_IDS.filter((id) => appIds.includes(id)) });
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const appId = request.nextUrl.searchParams.get("appId");
  if (!isConnectedAppId(appId)) return NextResponse.json({ error: "Unsupported app." }, { status: 400 });
  const { error } = await integrationsRepository.from("user_app_preferences").delete().eq("user_id", user.id).eq("app_id", appId);
  if (error) return NextResponse.json({ error: "Could not remove the app." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
