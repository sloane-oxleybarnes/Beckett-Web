import type { EventHint } from "@sentry/nextjs";

type ScrubbableEvent = {
  request?: {
    headers?: Record<string, unknown>;
    data?: unknown;
  };
  extra?: unknown;
  contexts?: unknown;
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

  return event;
}
