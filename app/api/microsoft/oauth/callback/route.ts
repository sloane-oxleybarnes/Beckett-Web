import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  exchangeMicrosoftCode,
  getMicrosoftProfile,
  getMicrosoftRedirectUri,
  isMicrosoftConfigured,
  saveMicrosoftConnection,
} from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

function redirectToSettings(url: URL, error?: string) {
  const target = new URL("/dashboard/settings", url.origin);
  if (error) target.searchParams.set("microsoft_error", error.slice(0, 180));
  else target.searchParams.set("microsoft", "connected");
  target.hash = "connected-accounts";
  const response = NextResponse.redirect(target);
  response.cookies.delete("beckett_microsoft_oauth_state");
  response.cookies.delete("beckett_microsoft_oauth_verifier");
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) return redirectToSettings(url, providerError);

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectToSettings(url, "sign-in-required");

  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("beckett_microsoft_oauth_state")?.value;
  const codeVerifier = request.cookies.get("beckett_microsoft_oauth_verifier")?.value;
  if (!state || !expectedState || state !== expectedState || !codeVerifier) {
    return redirectToSettings(url, "invalid-state");
  }

  const code = url.searchParams.get("code");
  if (!code || !isMicrosoftConfigured(url.origin)) {
    return redirectToSettings(url, "configuration-required");
  }

  try {
    const token = await exchangeMicrosoftCode(code, getMicrosoftRedirectUri(url.origin), codeVerifier);
    const profile = await getMicrosoftProfile(token.access_token || "");
    await saveMicrosoftConnection(user.id, token, profile);
    return redirectToSettings(url);
  } catch (error) {
    return redirectToSettings(url, error instanceof Error ? error.message : "Microsoft connection failed");
  }
}
