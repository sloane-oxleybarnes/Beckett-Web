import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "beckett-google-token:v1";
const ALGORITHM = "aes-256-gcm";
const AAD = Buffer.from(PREFIX, "utf8");

function encryptionKey() {
  const value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured.");
  }

  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }

  return key;
}

/** Encrypts Google OAuth credentials before they are written to the database. */
export function encryptGoogleAccessToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}:${iv.toString("base64url")}:${authTag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

/** Returns null for a missing, legacy, or invalid stored credential. */
export function decryptGoogleAccessToken(value: string | null | undefined) {
  if (!value?.startsWith(`${PREFIX}:`)) return null;

  const [, version, ivValue, tagValue, ciphertextValue] = value.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) return null;

  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Returns every Google credential that should be revoked for a stored integration. */
export function decryptGoogleCredentialTokens(value: string | null | undefined) {
  const decrypted = decryptGoogleAccessToken(value);
  if (!decrypted) return [];
  try {
    const credential = JSON.parse(decrypted) as { accessToken?: unknown; refreshToken?: unknown };
    const tokens = [credential.accessToken, credential.refreshToken]
      .filter((token): token is string => typeof token === "string" && token.length > 0);
    if (tokens.length > 0) return [...new Set(tokens)];
  } catch {
    // Gmail stores a single access token rather than a JSON calendar credential.
  }
  return [decrypted];
}
