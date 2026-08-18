import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { safeInternalPath } from "@/lib/auth-next";
import {
  exchangeMicrosoftCode,
  getMicrosoftProfile,
  getMicrosoftRedirectUri,
  isMicrosoftConfigured,
  MICROSOFT_CALENDAR_WRITE_SCOPES,
  MICROSOFT_MAIL_SCOPES,
  MICROSOFT_MAIL_WRITE_SCOPES,
  MICROSOFT_SCOPES,
  saveMicrosoftConnection,
} from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

function redirectAfterOAuth(url: URL, next: string | null, error?: string) {
  const target = !error && next ? new URL(next, url.origin) : new URL("/dashboard/apps", url.origin);
  if (error) target.searchParams.set("microsoft_error", error.slice(0, 180));
  else target.searchParams.set("microsoft", "connected");
  const response = NextResponse.redirect(target);
  response.cookies.delete("beckett_microsoft_oauth_state");
  response.cookies.delete("beckett_microsoft_oauth_verifier");
  response.cookies.delete("beckett_microsoft_oauth_kind");
  response.cookies.delete("beckett_microsoft_oauth_next");
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeInternalPath(request.cookies.get("beckett_microsoft_oauth_next")?.value);
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) return redirectAfterOAuth(url, next, providerError);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectAfterOAuth(url, next, "sign-in-required");

  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("beckett_microsoft_oauth_state")?.value;
  const codeVerifier = request.cookies.get("beckett_microsoft_oauth_verifier")?.value;
  const oauthKind = request.cookies.get("beckett_microsoft_oauth_kind")?.value || "calendar";
  const scopes = oauthKind === "mail"
    ? MICROSOFT_MAIL_SCOPES
    : oauthKind === "calendar-write"
      ? MICROSOFT_CALENDAR_WRITE_SCOPES
      : oauthKind === "mail-write"
        ? MICROSOFT_MAIL_WRITE_SCOPES
        : MICROSOFT_SCOPES;
  if (!state || !expectedState || state !== expectedState || !codeVerifier) {
    return redirectAfterOAuth(url, next, "invalid-state");
  }

  const code = url.searchParams.get("code");
  if (!code || !isMicrosoftConfigured(url.origin)) {
    return redirectAfterOAuth(url, next, "configuration-required");
  }

  try {
    const token = await exchangeMicrosoftCode(code, getMicrosoftRedirectUri(url.origin), codeVerifier, scopes);
    const profile = await getMicrosoftProfile(token.access_token || "");
    await saveMicrosoftConnection(user.id, token, profile);
    return redirectAfterOAuth(url, next);
  } catch (error) {
    return redirectAfterOAuth(url, next, error instanceof Error ? error.message : "Microsoft connection failed");
  }
}
