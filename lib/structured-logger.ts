type LogLevel = "info" | "warn" | "error";
type Metadata = Readonly<Record<string, unknown>>;

const SAFE_METADATA_KEYS = new Set([
  "action",
  "attempt",
  "code",
  "contextType",
  "count",
  "errorCode",
  "flowType",
  "hasBotToken",
  "hasConnectedUser",
  "httpStatus",
  "messageCount",
  "operation",
  "outcome",
  "plan",
  "provider",
  "reason",
  "requestId",
  "responseType",
  "route",
  "source",
  "stage",
  "status",
  "timingMs",
]);

function safeMetadata(metadata: Metadata) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) =>
      SAFE_METADATA_KEYS.has(key) &&
      (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    ),
  );
}

export function structuredLogRecord(level: LogLevel, event: string, metadata: Metadata = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    service: "beckett-web",
    event: event.replace(/[^a-z0-9_.-]/gi, "_").slice(0, 100),
    ...safeMetadata(metadata),
  };
}

export function safeErrorCode(error: unknown, fallback = "unexpected_error") {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (/^[a-z][a-z0-9_:-]{1,63}$/i.test(message)) return message.toLowerCase();
  if (error.name && error.name !== "Error") return error.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  return fallback;
}

export function logInfo(event: string, metadata?: Metadata) {
  console.info(JSON.stringify(structuredLogRecord("info", event, metadata)));
}

export function logWarning(event: string, metadata?: Metadata) {
  console.warn(JSON.stringify(structuredLogRecord("warn", event, metadata)));
}

export function logError(event: string, error?: unknown, metadata: Metadata = {}) {
  console.error(JSON.stringify(structuredLogRecord("error", event, {
    ...metadata,
    errorCode: metadata.errorCode || safeErrorCode(error),
  })));
}
