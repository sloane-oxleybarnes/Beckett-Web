import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type SlackVerificationResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

function signingSecrets() {
  return [
    process.env.SLACK_SIGNING_SECRET,
    process.env.SLACK_STAGING_SIGNING_SECRET,
    process.env.SLACK_PRODUCTION_SIGNING_SECRET,
  ]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function safeCompare(value: string, expected: string) {
  const valueBuffer = Buffer.from(value, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

export function verifySlackRequest(req: NextRequest, rawBody: string): SlackVerificationResult {
  const secrets = signingSecrets();
  if (!secrets.length) {
    return { ok: false, status: 500, message: "Slack signing secret is not configured." };
  }

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");
  const timestampNumber = Number(timestamp);
  if (!timestamp || !signature || !Number.isFinite(timestampNumber)) {
    return { ok: false, status: 401, message: "Missing Slack signature." };
  }
  if (Math.abs(Date.now() / 1000 - timestampNumber) > 60 * 5) {
    return { ok: false, status: 401, message: "Slack request is too old." };
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const verified = secrets.some((secret) => {
    const expected = `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
    return safeCompare(signature, expected);
  });

  return verified
    ? { ok: true }
    : { ok: false, status: 401, message: "Invalid Slack signature." };
}
