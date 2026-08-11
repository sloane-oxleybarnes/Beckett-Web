import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  buildMicrosoftAuthorizationUrl,
  createMicrosoftCodeChallenge,
  getMicrosoftClientId,
  getMicrosoftRedirectUri,
  MICROSOFT_MAIL_SCOPES,
  MICROSOFT_CALENDAR_WRITE_SCOPES,
  MICROSOFT_MAIL_WRITE_SCOPES,
  MICROSOFT_SCOPES,
} from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));

  const clientId = getMicrosoftClientId();
  const redirectUri = getMicrosoftRedirectUri(new URL(request.url).origin);
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/dashboard/settings?microsoft_error=not_configured", request.url));
  }

  const kindParam = request.nextUrl.searchParams.get("kind");
  const requestedKind = kindParam === "mail" || kindParam === "calendar-write" || kindParam === "mail-write" ? kindParam : "calendar";
  const scopes = requestedKind === "mail"
    ? MICROSOFT_MAIL_SCOPES
    : requestedKind === "calendar-write"
      ? MICROSOFT_CALENDAR_WRITE_SCOPES
      : requestedKind === "mail-write"
        ? MICROSOFT_MAIL_WRITE_SCOPES
        : MICROSOFT_SCOPES;
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(64).toString("base64url");
  const response = NextResponse.redirect(
    buildMicrosoftAuthorizationUrl(state, redirectUri, createMicrosoftCodeChallenge(codeVerifier), scopes),
  );
  response.cookies.set("beckett_microsoft_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  response.cookies.set("beckett_microsoft_oauth_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  response.cookies.set("beckett_microsoft_oauth_kind", requestedKind, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
