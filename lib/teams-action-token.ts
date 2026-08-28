import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { TeamsActionIntent } from "@/features/teams/contracts";

const VERSION = "v1";
const MAX_AGE_MS = 5 * 60 * 1000;

export type TeamsActionTokenPayload = {
  requestId: string;
  activityId: string;
  aadObjectId: string;
  tenantId: string | null;
  intent: TeamsActionIntent;
  messageText: string;
  issuedAt: number;
};

function teamsActionKey() {
  const raw = process.env.MICROSOFT_TEAMS_ACTION_TOKEN_KEY?.trim();
  if (!raw) throw new Error("Microsoft Teams action-token encryption is not configured");
  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) return base64;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  throw new Error("MICROSOFT_TEAMS_ACTION_TOKEN_KEY must be a 32-byte base64 or 64-character hex value");
}

export function teamsActionRequestId(activityId: string, intent: TeamsActionIntent) {
  return createHash("sha256").update(`${activityId}\u0000${intent}`).digest("hex");
}

export function encryptTeamsActionToken(input: Omit<TeamsActionTokenPayload, "issuedAt" | "requestId">) {
  const payload: TeamsActionTokenPayload = {
    ...input,
    requestId: teamsActionRequestId(input.activityId, input.intent),
    issuedAt: Date.now(),
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", teamsActionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptTeamsActionToken(value: string, now = Date.now()): TeamsActionTokenPayload {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Invalid Microsoft Teams action token");
  }
  const decipher = createDecipheriv("aes-256-gcm", teamsActionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  const payload = JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8")) as Partial<TeamsActionTokenPayload>;

  if (
    !payload.requestId
    || !payload.activityId
    || !payload.aadObjectId
    || !payload.messageText
    || !["decode", "draft", "rewrite"].includes(payload.intent as string)
    || typeof payload.issuedAt !== "number"
    || payload.issuedAt > now + 30_000
    || now - payload.issuedAt > MAX_AGE_MS
  ) {
    throw new Error("Microsoft Teams action token is invalid or expired");
  }
  return payload as TeamsActionTokenPayload;
}
