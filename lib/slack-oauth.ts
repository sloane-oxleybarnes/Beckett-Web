const DEFAULT_SLACK_OAUTH_WORKER_URL = "https://lumen-slack.sloane-oxleyhase.workers.dev";

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
