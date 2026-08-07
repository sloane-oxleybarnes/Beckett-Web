import { NextRequest, NextResponse } from "next/server";
import { encryptGoogleAccessToken } from "@/lib/google-token-security";
import { GOOGLE_GMAIL_SCOPE, getGoogleGmailOAuthConfig } from "@/lib/google-gmail-oauth";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { trackBetaEvent } from "@/lib/beta-events";

const COOKIE_PATH = "/api/gmail/oauth";

function completeRedirect(origin: string, status: string, returnTo = "/dashboard/apps") {
  const response = NextResponse.redirect(new URL(`${returnTo}?gmail=${encodeURIComponent(status)}`, origin));
  for (const name of ["beckett_gmail_state", "beckett_gmail_verifier", "beckett_gmail_user", "beckett_gmail_next"]) {
    response.cookies.set(name, "", { httpOnly: true, sameSite: "lax", secure: true, path: COOKIE_PATH, maxAge: 0 });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const storedReturnTo = request.cookies.get("beckett_gmail_next")?.value;
  const returnTo = storedReturnTo === "/dashboard/settings" ? "/dashboard/settings" : "/dashboard/apps";
  const error = searchParams.get("error");
  if (error) return completeRedirect(origin, error === "access_denied" ? "cancelled" : "authorization-failed", returnTo);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("beckett_gmail_state")?.value;
  const verifier = request.cookies.get("beckett_gmail_verifier")?.value;
  const expectedUserId = request.cookies.get("beckett_gmail_user")?.value;
  if (!code || !state || !expectedState || state !== expectedState || !verifier || !expectedUserId) {
    return completeRedirect(origin, "authorization-failed", returnTo);
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== expectedUserId) return completeRedirect(origin, "session-expired", returnTo);

  const config = getGoogleGmailOAuthConfig(origin);
  if (!config) return completeRedirect(origin, "configuration-required", returnTo);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) {
    const failure = (await tokenResponse.json().catch(() => null)) as { error?: unknown; error_description?: unknown } | null;
    console.error("Google Gmail OAuth token exchange failed", {
      status: tokenResponse.status,
      error: typeof failure?.error === "string" ? failure.error : null,
      description: typeof failure?.error_description === "string" ? failure.error_description : null,
    });
    return completeRedirect(origin, "authorization-failed", returnTo);
  }

  const token = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!token.access_token || !token.refresh_token || typeof token.expires_in !== "number") {
    return completeRedirect(origin, "authorization-failed", returnTo);
  }

  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  const profile = profileResponse.ok ? (await profileResponse.json()) as { emailAddress?: string } : null;
  const now = new Date().toISOString();
  const { error: upsertError } = await supabaseAdmin.from("user_integrations").upsert(
    {
      user_id: user.id,
      provider: "google",
      access_token: encryptGoogleAccessToken(JSON.stringify({
        version: 1,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + token.expires_in * 1000,
      })),
      external_user_id: profile?.emailAddress || null,
      external_team_id: null,
      external_team_name: null,
      metadata: {
        provider: "google",
        email: profile?.emailAddress || null,
        scopes: GOOGLE_GMAIL_SCOPE.replace("https://www.googleapis.com/auth/", ""),
        token_encryption: "aes-256-gcm:v1",
      },
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "user_id,provider" }
  );
  if (upsertError) {
    console.error("Google Gmail connection could not be saved", { code: upsertError.code, message: upsertError.message });
    return completeRedirect(origin, "connection-failed", returnTo);
  }

  await trackBetaEvent({ userId: user.id, email: user.email, eventName: "gmail_connected", source: "web_app", metadata: { integration: "google" } });
  return completeRedirect(origin, "connected", returnTo);
}
