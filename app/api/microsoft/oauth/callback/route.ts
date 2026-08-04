import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  exchangeMicrosoftCode,
  getMicrosoftClientId,
  getMicrosoftClientSecret,
  getMicrosoftProfile,
  getMicrosoftRedirectUri,
  MICROSOFT_MAIL_SCOPES,
  MICROSOFT_CALENDAR_WRITE_SCOPES,
  MICROSOFT_MAIL_WRITE_SCOPES,
  MICROSOFT_SCOPES,
  saveMicrosoftConnection,
} from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const redirect = new URL("/dashboard/settings", url.origin);
  const errorCode = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (errorCode || errorDescription) {
    const message = errorCode === "server_error"
      ? "Microsoft returned a temporary authorization error. Try connecting Microsoft 365 first, then enable optional permissions one at a time."
      : errorDescription || errorCode || "Microsoft authorization was not completed.";
    redirect.searchParams.set("microsoft_error", message.slice(0, 240));
    return NextResponse.redirect(redirect);
  }
  if (!user) {
    redirect.searchParams.set("microsoft_error", "sign_in_required");
    return NextResponse.redirect(redirect);
  }

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
    redirect.searchParams.set("microsoft_error", "invalid_state");
    return NextResponse.redirect(redirect);
  }

  const code = url.searchParams.get("code");
  if (!code || !getMicrosoftClientId() || !getMicrosoftClientSecret()) {
    redirect.searchParams.set("microsoft_error", "missing_code_or_configuration");
    return NextResponse.redirect(redirect);
  }

  try {
    const token = await exchangeMicrosoftCode(code, getMicrosoftRedirectUri(url.origin), codeVerifier, scopes);
    const profile = await getMicrosoftProfile(token.access_token || "");
    await saveMicrosoftConnection(user.id, token, profile);
    redirect.searchParams.set("microsoft", "connected");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Microsoft connection failed";
    redirect.searchParams.set("microsoft_error", message.slice(0, 240));
  }

  const response = NextResponse.redirect(redirect);
  response.cookies.delete("beckett_microsoft_oauth_state");
  response.cookies.delete("beckett_microsoft_oauth_verifier");
  response.cookies.delete("beckett_microsoft_oauth_kind");
  return response;
}
