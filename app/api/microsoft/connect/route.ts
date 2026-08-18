import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { safeInternalPath } from "@/lib/auth-next";
import {
  buildMicrosoftAuthorizationUrl,
  createMicrosoftCodeChallenge,
  getMicrosoftRedirectUri,
  isMicrosoftConfigured,
  MICROSOFT_CALENDAR_WRITE_SCOPES,
  MICROSOFT_MAIL_SCOPES,
  MICROSOFT_MAIL_WRITE_SCOPES,
  MICROSOFT_SCOPES,
} from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Preserve the one-time Microsoft linking action through Beckett sign-in.
    // Without this, a successful login lands on the dashboard and never
    // creates the Microsoft identity record that the Outlook add-in needs.
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  const origin = new URL(request.url).origin;
  const redirectUri = getMicrosoftRedirectUri(origin);
  if (!isMicrosoftConfigured(origin)) {
    return NextResponse.redirect(new URL("/dashboard/apps?microsoft_error=configuration-required", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(64).toString("base64url");
  const next = safeInternalPath(request.nextUrl.searchParams.get("next"));
  const kindParam = request.nextUrl.searchParams.get("kind");
  const requestedKind = kindParam === "mail" || kindParam === "calendar-write" || kindParam === "mail-write"
    ? kindParam
    : "calendar";
  const scopes = requestedKind === "mail"
    ? MICROSOFT_MAIL_SCOPES
    : requestedKind === "calendar-write"
      ? MICROSOFT_CALENDAR_WRITE_SCOPES
      : requestedKind === "mail-write"
        ? MICROSOFT_MAIL_WRITE_SCOPES
        : MICROSOFT_SCOPES;
  const response = NextResponse.redirect(
    buildMicrosoftAuthorizationUrl(state, redirectUri, createMicrosoftCodeChallenge(codeVerifier), scopes),
  );
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 10 * 60,
    path: "/",
  };
  response.cookies.set("beckett_microsoft_oauth_state", state, cookieOptions);
  response.cookies.set("beckett_microsoft_oauth_verifier", codeVerifier, cookieOptions);
  response.cookies.set("beckett_microsoft_oauth_kind", requestedKind, cookieOptions);
  if (next) response.cookies.set("beckett_microsoft_oauth_next", next, cookieOptions);
  else response.cookies.delete("beckett_microsoft_oauth_next");
  return response;
}
