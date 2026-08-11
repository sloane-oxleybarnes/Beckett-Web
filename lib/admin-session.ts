import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_TTL_SECONDS = 60 * 60 * 24;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createAdminSession() {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode(JSON.stringify({
    v: 1,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: randomBytes(16).toString("hex"),
  }));

  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(token: string | undefined | null) {
  if (!token) return false;

  try {
    const [encodedPayload, providedSignature] = token.split(".");
    if (!encodedPayload || !providedSignature) return false;

    const expectedSignature = sign(encodedPayload);
    const expected = Buffer.from(expectedSignature, "utf8");
    const provided = Buffer.from(providedSignature, "utf8");
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return false;
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      v?: unknown;
      exp?: unknown;
    };

    return payload.v === 1 && typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
