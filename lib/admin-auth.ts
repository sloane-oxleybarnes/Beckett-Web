import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_auth";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function signingSecret() {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return null;
  return process.env.ADMIN_SESSION_SECRET?.trim() || `beckett-admin-session:${password}`;
}

function signature(payload: string) {
  const secret = signingSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSession() {
  const payload = `${Date.now() + SESSION_TTL_SECONDS * 1000}`;
  const signed = signature(payload);
  return signed ? `${payload}.${signed}` : null;
}

export function isValidAdminSession(value: string | undefined | null) {
  if (!value) return false;
  const [expiresAt, provided] = value.split(".");
  if (!expiresAt || !provided || Number(expiresAt) <= Date.now()) return false;
  const expected = signature(expiresAt);
  if (!expected || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function isAdminCookieValue(value: string | undefined | null) {
  return isValidAdminSession(value);
}

export async function isAdminRequest() {
  const cookieStore = await cookies();
  return isValidAdminSession(cookieStore.get(COOKIE_NAME)?.value);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  };
}
