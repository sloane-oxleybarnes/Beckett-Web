import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/server-auth";
import { getSlackOAuthWorkerUrl, getSlackRedirectOrigin } from "@/lib/slack-oauth";
import { signSlackState } from "@/lib/slack-signed-state";

export async function GET(req: NextRequest) {
  const { user } = await getAuthenticatedContext();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login?next=/dashboard/settings", req.url));
  }

  const origin = getSlackRedirectOrigin();
  const redirectUri = `${origin}/api/slack/callback`;
  const state = signSlackState({ purpose: "connect", userId: user.id });
  const slackOAuthWorker = getSlackOAuthWorkerUrl();

  if (!slackOAuthWorker) {
    return NextResponse.redirect(new URL("/dashboard/settings?slack=setup_error", req.url));
  }

  const authRes = await fetch(
    `${slackOAuthWorker}/auth-url?${new URLSearchParams({ redirect_uri: redirectUri, state })}`,
    { cache: "no-store" }
  ).catch(() => null);

  if (!authRes?.ok) {
    return NextResponse.redirect(new URL("/dashboard/settings?slack=setup_error", req.url));
  }

  const authData = (await authRes.json().catch(() => ({}))) as { auth_url?: string; error?: string };
  if (!authData.auth_url) {
    return NextResponse.redirect(new URL("/dashboard/settings?slack=setup_error", req.url));
  }

  let url: URL;
  try {
    url = new URL(authData.auth_url);
  } catch {
    return NextResponse.redirect(new URL("/dashboard/settings?slack=setup_error", req.url));
  }
  return NextResponse.redirect(url);
}
