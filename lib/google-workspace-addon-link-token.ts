import { createHash, randomBytes } from "node:crypto";

export function createWorkspaceAddOnLinkToken() {
  return randomBytes(32).toString("base64url");
}

export function hashWorkspaceAddOnLinkToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isWorkspaceAddOnLinkToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
