import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  buildMicrosoftAuthorizationUrl,
  createMicrosoftCodeChallenge,
  getMicrosoftRedirectUri,
  isMicrosoftConfigured,
} from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Preserve the one-time Microsoft linking action through Beckett sign-in.
    // Without this, a successful login lands on the dashboard and never
    // creates the Microsoft identity record that the Outlook add-in needs.
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("next", "/api/microsoft/connect");
    return NextResponse.redirect(login);
  }

  const origin = new URL(request.url).origin;
  const redirectUri = getMicrosoftRedirectUri(origin);
  if (!isMicrosoftConfigured(origin)) {
    return NextResponse.redirect(new URL("/dashboard/settings?microsoft_error=configuration-required#connected-accounts", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(64).toString("base64url");
  const response = NextResponse.redirect(
    buildMicrosoftAuthorizationUrl(state, redirectUri, createMicrosoftCodeChallenge(codeVerifier)),
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
  return response;
}
