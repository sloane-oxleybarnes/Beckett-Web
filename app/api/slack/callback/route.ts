import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { trackBetaEvent } from "@/lib/beta-events";
import { getSlackOAuthWorkerUrl, getSlackRedirectOrigin } from "@/lib/slack-oauth";
import { linkSlackUser, saveSlackInstallation } from "@/lib/slack-installation";
import { verifySlackState } from "@/lib/slack-signed-state";

function scopes(value?: string) {
  return String(value || "").split(",").map((scope) => scope.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateValue = req.nextUrl.searchParams.get("state") || "";
  const state = verifySlackState(stateValue);
  if (!code || !state || (state.purpose !== "install" && state.purpose !== "connect")) {
    return NextResponse.redirect(new URL("/slack/installed?error=auth", req.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (state.purpose === "connect" && (!session || session.user.id !== state.userId)) {
    return NextResponse.redirect(new URL("/auth/login?next=/dashboard/settings", req.url));
  }

  const redirectUri = `${getSlackRedirectOrigin()}/api/slack/callback`;
  const worker = getSlackOAuthWorkerUrl();
  if (!worker) return NextResponse.redirect(new URL("/slack/installed?error=setup", req.url));

  const tokenResponse = await fetch(worker, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  }).catch(() => null);
  const token = await tokenResponse?.json().catch(() => ({})) as {
    ok?: boolean;
    access_token?: string | null;
    refresh_token?: string | null;
    expires_in?: number | null;
    scope?: string;
    team?: { id?: string | null } | null;
    enterprise?: { id?: string | null } | null;
    authed_user?: { id?: string | null } | null;
  };
  if (!tokenResponse?.ok || !token.ok || !token.access_token || !token.team?.id) {
    return NextResponse.redirect(new URL("/slack/installed?error=auth", req.url));
  }

  await saveSlackInstallation({
    teamId: token.team.id,
    enterpriseId: token.enterprise?.id,
    installerUserId: session?.user.id || null,
    botAccessToken: token.access_token,
    botRefreshToken: token.refresh_token,
    expiresIn: token.expires_in,
    botScopes: scopes(token.scope),
  });

  if (session?.user.id && token.authed_user?.id) {
    await linkSlackUser({ teamId: token.team.id, slackUserId: token.authed_user.id, beckettUserId: session.user.id });
    await trackBetaEvent({
      userId: session.user.id,
      email: session.user.email,
      eventName: "slack_connected",
      source: "web_app",
      metadata: { teamId: token.team.id },
    });
  }

  return NextResponse.redirect(new URL(state.purpose === "connect" ? "/dashboard/settings?slack=connected" : "/slack/installed", req.url));
}
