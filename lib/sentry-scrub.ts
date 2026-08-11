import type { EventHint } from "@sentry/nextjs";
import { scrubSlackTelemetry, SLACK_ZERO_COPY_FILTERED } from "./slack-zero-copy";

type ScrubbableEvent = {
  request?: {
    url?: string;
    headers?: Record<string, unknown>;
    data?: unknown;
  };
  extra?: unknown;
  contexts?: unknown;
  breadcrumbs?: unknown;
  exception?: unknown;
  tags?: Record<string, unknown>;
  transaction?: string;
};

const SENSITIVE_KEYS = [
  "access_token",
  "analysis_result",
  "authorization",
  "body",
  "comment",
  "context",
  "context_snapshot",
  "cookie",
  "email_thread",
  "message",
  "messages",
  "password",
  "prompt",
  "response_text",
  "thread",
  "token",
];

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
        return [key, "[Filtered]"];
      }
      return [key, scrubValue(nested)];
    })
  );
}

function isSlackEvent(event: ScrubbableEvent) {
  const requestUrl = String(event.request?.url || "");
  const integrationTag = String(event.tags?.integration || event.tags?.provider || "").toLowerCase();
  const transaction = String(event.transaction || "").toLowerCase();
  return requestUrl.includes("/api/slack/") || integrationTag === "slack" || transaction.includes("/api/slack/");
}

export function scrubSentryEvent<T extends ScrubbableEvent>(event: T, _hint?: EventHint): T {
  void _hint;
  if (event.request?.headers) {
    delete event.request.headers.cookie;
    delete event.request.headers.authorization;
  }

  if (event.request?.data) {
    event.request.data = scrubValue(event.request.data);
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra);
  }

  if (event.contexts) {
    event.contexts = scrubValue(event.contexts);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = scrubValue(event.breadcrumbs);
  }

  if (isSlackEvent(event)) {
    if (event.request?.data) event.request.data = SLACK_ZERO_COPY_FILTERED;
    if (event.extra) event.extra = scrubSlackTelemetry(event.extra);
    if (event.contexts) event.contexts = scrubSlackTelemetry(event.contexts);
    if (event.breadcrumbs) event.breadcrumbs = SLACK_ZERO_COPY_FILTERED;
    if (event.exception) event.exception = SLACK_ZERO_COPY_FILTERED;
  }

  return event;
}
