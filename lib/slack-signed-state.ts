import { createHmac, timingSafeEqual } from "node:crypto";

export type SlackSignedState = {
  purpose: "install" | "connect" | "account_link";
  userId?: string;
  teamId?: string;
  slackUserId?: string;
  exp: number;
  nonce: string;
};

function secret() {
  const value = process.env.SLACK_LINK_SIGNING_SECRET || process.env.SLACK_SIGNING_SECRET;
  if (!value) throw new Error("Slack signed-link secret is not configured");
  return value;
}

export function signSlackState(input: Omit<SlackSignedState, "exp" | "nonce">, ttlSeconds = 600) {
  const payload: SlackSignedState = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: crypto.randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySlackState(value: string, expectedPurpose?: SlackSignedState["purpose"]) {
  const [encoded, supplied] = value.split(".");
  if (!encoded || !supplied) return null;
  const expected = createHmac("sha256", secret()).update(encoded).digest("base64url");
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SlackSignedState;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (expectedPurpose && payload.purpose !== expectedPurpose) return null;
    return payload;
  } catch {
    return null;
  }
}
