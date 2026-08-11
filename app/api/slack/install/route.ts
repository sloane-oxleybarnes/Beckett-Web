import { NextRequest, NextResponse } from "next/server";
import { getSlackOAuthWorkerUrl, getSlackRedirectOrigin } from "@/lib/slack-oauth";
import { signSlackState } from "@/lib/slack-signed-state";

export async function GET(req: NextRequest) {
  const worker = getSlackOAuthWorkerUrl();
  const redirectUri = `${getSlackRedirectOrigin()}/api/slack/callback`;
  if (!worker) return NextResponse.redirect(new URL("/slack/installed?error=setup", req.url));
  const state = signSlackState({ purpose: "install" });
  const response = await fetch(`${worker}/auth-url?${new URLSearchParams({ redirect_uri: redirectUri, state })}`, { cache: "no-store" }).catch(() => null);
  const data = await response?.json().catch(() => ({})) as { auth_url?: string };
  if (!response?.ok || !data.auth_url) return NextResponse.redirect(new URL("/slack/installed?error=setup", req.url));
  return NextResponse.redirect(data.auth_url);
}
