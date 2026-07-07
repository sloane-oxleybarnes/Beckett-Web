import { normalizePublicUrl } from "@/lib/deployment-env";

const DEFAULT_SLACK_OAUTH_WORKER_URL = "https://lumen-slack.sloane-oxleyhase.workers.dev";
const DEFAULT_SLACK_REDIRECT_ORIGIN = "https://www.meetbeckett.co";

export function getSlackOAuthWorkerUrl() {
  let raw = String(process.env.SLACK_OAUTH_WORKER_URL || DEFAULT_SLACK_OAUTH_WORKER_URL).trim();

  raw = raw.replace(/^['"]|['"]$/g, "");

  if (/^[A-Z0-9_]+=/.test(raw)) {
    raw = raw.slice(raw.indexOf("=") + 1).trim();
  }

  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export function getSlackRedirectOrigin() {
  return (
    normalizePublicUrl(process.env.SLACK_REDIRECT_ORIGIN) ||
    normalizePublicUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    DEFAULT_SLACK_REDIRECT_ORIGIN
  );
}
