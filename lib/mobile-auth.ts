import "server-only";

import { createClient, type Session, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";

export type MobileUser = Pick<User, "id" | "email">;

function mobileAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
}

export function bearerToken(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
}

export async function getMobileUser(request: NextRequest): Promise<MobileUser | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const { data: { user }, error } = await integrationsRepository.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email };
}

export function mobileSessionDto(session: Session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at || null,
    tokenType: session.token_type,
    user: { id: session.user.id, email: session.user.email || null },
  };
}

export async function requestMobileEmailCode(email: string) {
  return mobileAuthClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
}

export async function verifyMobileEmailCode(email: string, code: string) {
  return mobileAuthClient().auth.verifyOtp({ email, token: code, type: "email" });
}

export async function signInMobileWithApple(identityToken: string, nonce: string) {
  return mobileAuthClient().auth.signInWithIdToken({
    provider: "apple",
    token: identityToken,
    nonce,
  });
}

export async function refreshMobileSession(refreshToken: string) {
  return mobileAuthClient().auth.refreshSession({ refresh_token: refreshToken });
}
