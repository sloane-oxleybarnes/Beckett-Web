import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function getMicrosoftTokenKey() {
  const raw = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("Microsoft OAuth token encryption is not configured");

  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) return base64;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");

  throw new Error("MICROSOFT_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value");
}

export function encryptOAuthToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getMicrosoftTokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptOAuthToken(value: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Invalid encrypted Microsoft OAuth token");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getMicrosoftTokenKey(),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
