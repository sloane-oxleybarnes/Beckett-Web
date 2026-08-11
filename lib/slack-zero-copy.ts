export const SLACK_ZERO_COPY_FILTERED = "[Filtered: Slack zero-copy]";

export const SLACK_DURABLE_INTERACTION_KEYS = [
  "slackTeamId",
  "slackUserId",
  "beckettUserId",
  "slackChannelId",
  "slackThreadTs",
  "slackMessageTs",
  "slackSourceChannelId",
  "slackSourceThreadTs",
  "slackSourceMessageTs",
  "flowType",
  "currentStep",
  "status",
  "grantedScopes",
  "creditsCharged",
  "requestId",
  "eventType",
  "success",
  "errorCode",
  "latencyMs",
  "occurredAt",
  "searchAvailable",
  "expiresAt",
] as const;

export type SlackZeroCopyFlowType =
  | "general"
  | "decode"
  | "respond"
  | "rewrite"
  | "relationship"
  | "message"
  | "prep"
  | "practice";

export type SlackZeroCopyFlowStatus = "active" | "completed" | "archived" | "failed";

export type SlackDurableInteractionMetadata = {
  slackTeamId: string;
  slackUserId: string;
  beckettUserId?: string | null;
  slackChannelId?: string | null;
  slackThreadTs?: string | null;
  slackMessageTs?: string | null;
  slackSourceChannelId?: string | null;
  slackSourceThreadTs?: string | null;
  slackSourceMessageTs?: string | null;
  flowType?: SlackZeroCopyFlowType | null;
  currentStep?: string | null;
  status?: SlackZeroCopyFlowStatus | null;
  grantedScopes?: string[];
  creditsCharged?: number;
  requestId?: string | null;
  eventType?: string | null;
  success?: boolean;
  errorCode?: string | null;
  latencyMs?: number;
  occurredAt?: string;
  searchAvailable?: boolean;
  expiresAt?: string | null;
};

export type SlackDurableInstallationSecrets = {
  slackTeamId: string;
  encryptedBotAccessToken: string;
  encryptedUserAccessToken?: string | null;
  encryptedRefreshToken?: string | null;
  tokenExpiresAt?: string | null;
  installedAt: string;
  updatedAt: string;
};

export type SlackTransientRequestContext = {
  selectedMessageText?: string | null;
  threadMessages?: Array<Record<string, unknown>>;
  searchQuery?: string | null;
  searchResults?: Array<Record<string, unknown>>;
  channelName?: string | null;
  participantNames?: string[];
  userPrompt?: string | null;
  guidedAnswers?: Record<string, string>;
  aiPrompt?: string | null;
  generatedResponse?: string | null;
};

const DURABLE_KEY_SET = new Set<string>(SLACK_DURABLE_INTERACTION_KEYS);
const FLOW_TYPES = new Set<SlackZeroCopyFlowType>([
  "general",
  "decode",
  "respond",
  "rewrite",
  "relationship",
  "message",
  "prep",
  "practice",
]);
const FLOW_STATUSES = new Set<SlackZeroCopyFlowStatus>(["active", "completed", "archived", "failed"]);
const STRING_OR_NULL_KEYS = new Set([
  "beckettUserId",
  "slackChannelId",
  "slackThreadTs",
  "slackMessageTs",
  "slackSourceChannelId",
  "slackSourceThreadTs",
  "slackSourceMessageTs",
  "currentStep",
  "requestId",
  "eventType",
  "errorCode",
  "occurredAt",
  "expiresAt",
]);
const OPAQUE_IDENTIFIER_KEYS = new Set([
  "slackTeamId",
  "slackUserId",
  "beckettUserId",
  "slackChannelId",
  "slackThreadTs",
  "slackMessageTs",
  "slackSourceChannelId",
  "slackSourceThreadTs",
  "slackSourceMessageTs",
  "requestId",
]);
const CODE_KEYS = new Set(["currentStep", "eventType", "errorCode"]);
const NUMBER_KEYS = new Set(["creditsCharged", "latencyMs"]);
const BOOLEAN_KEYS = new Set(["success", "searchAvailable"]);
const OPAQUE_VALUE_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/;
const CODE_VALUE_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/;
const SCOPE_PATTERN = /^[A-Za-z0-9.*:_-]{1,96}$/;

const TELEMETRY_SAFE_KEYS = new Set([
  ...SLACK_DURABLE_INTERACTION_KEYS,
  "attempt",
  "httpStatus",
  "method",
  "operation",
  "rateLimited",
  "retryAfterMs",
]);

export class SlackZeroCopyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlackZeroCopyViolationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertOptionalString(value: unknown, key: string) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new SlackZeroCopyViolationError(`Slack durable metadata field ${key} must be a string or null.`);
  }
}

function isOpaqueValue(value: unknown) {
  return typeof value === "string" && OPAQUE_VALUE_PATTERN.test(value);
}

function isCodeValue(value: unknown) {
  return typeof value === "string" && CODE_VALUE_PATTERN.test(value);
}

export function assertSlackDurableInteractionMetadata(
  value: unknown
): asserts value is SlackDurableInteractionMetadata {
  if (!isRecord(value)) {
    throw new SlackZeroCopyViolationError("Slack durable interaction metadata must be a flat object.");
  }

  const unknownKeys = Object.keys(value).filter((key) => !DURABLE_KEY_SET.has(key));
  if (unknownKeys.length) {
    throw new SlackZeroCopyViolationError(
      `Slack durable interaction metadata contains non-allowlisted field(s): ${unknownKeys.join(", ")}.`
    );
  }

  if (typeof value.slackTeamId !== "string" || !value.slackTeamId) {
    throw new SlackZeroCopyViolationError("Slack durable interaction metadata requires slackTeamId.");
  }
  if (typeof value.slackUserId !== "string" || !value.slackUserId) {
    throw new SlackZeroCopyViolationError("Slack durable interaction metadata requires slackUserId.");
  }

  for (const key of Array.from(STRING_OR_NULL_KEYS)) assertOptionalString(value[key], key);

  for (const key of Array.from(OPAQUE_IDENTIFIER_KEYS)) {
    const nested = value[key];
    if (nested !== undefined && nested !== null && !isOpaqueValue(nested)) {
      throw new SlackZeroCopyViolationError(`Slack durable metadata field ${key} must be an opaque identifier.`);
    }
  }
  for (const key of Array.from(CODE_KEYS)) {
    const nested = value[key];
    if (nested !== undefined && nested !== null && !isCodeValue(nested)) {
      throw new SlackZeroCopyViolationError(`Slack durable metadata field ${key} must be a content-free code.`);
    }
  }
  for (const timestampKey of ["occurredAt", "expiresAt"] as const) {
    const timestamp = value[timestampKey];
    if (typeof timestamp === "string" && (Number.isNaN(Date.parse(timestamp)) || timestamp.length > 40)) {
      throw new SlackZeroCopyViolationError(`Slack durable interaction metadata ${timestampKey} must be an ISO timestamp.`);
    }
  }

  if (value.flowType !== undefined && value.flowType !== null && !FLOW_TYPES.has(value.flowType as SlackZeroCopyFlowType)) {
    throw new SlackZeroCopyViolationError("Slack durable interaction metadata contains an invalid flowType.");
  }
  if (value.status !== undefined && value.status !== null && !FLOW_STATUSES.has(value.status as SlackZeroCopyFlowStatus)) {
    throw new SlackZeroCopyViolationError("Slack durable interaction metadata contains an invalid status.");
  }
  if (value.grantedScopes !== undefined && (
    !Array.isArray(value.grantedScopes) || value.grantedScopes.some((scope) => !SCOPE_PATTERN.test(String(scope)))
  )) {
    throw new SlackZeroCopyViolationError("Slack durable interaction metadata grantedScopes must be a string array.");
  }
  for (const key of Array.from(NUMBER_KEYS)) {
    const nested = value[key];
    if (nested !== undefined && (typeof nested !== "number" || !Number.isFinite(nested) || nested < 0)) {
      throw new SlackZeroCopyViolationError(`Slack durable interaction metadata field ${key} must be non-negative.`);
    }
  }
  for (const key of Array.from(BOOLEAN_KEYS)) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      throw new SlackZeroCopyViolationError(`Slack durable interaction metadata field ${key} must be boolean.`);
    }
  }
}

export function createSlackDurableInteractionMetadata(
  value: SlackDurableInteractionMetadata
): Readonly<SlackDurableInteractionMetadata> {
  assertSlackDurableInteractionMetadata(value);
  return Object.freeze({
    ...value,
    ...(value.grantedScopes ? { grantedScopes: Object.freeze([...value.grantedScopes]) as unknown as string[] } : {}),
  });
}

export function normalizeSlackZeroCopyFlowType(value: string): SlackZeroCopyFlowType {
  if (
    value === "decode" ||
    value === "respond" ||
    value === "rewrite" ||
    value === "relationship" ||
    value === "message" ||
    value === "prep" ||
    value === "practice"
  ) {
    return value;
  }
  return "general";
}

export function buildSlackFlowSessionRow(value: SlackDurableInteractionMetadata) {
  const metadata = createSlackDurableInteractionMetadata(value);
  return {
    beckett_user_id: metadata.beckettUserId || null,
    slack_team_id: metadata.slackTeamId,
    slack_user_id: metadata.slackUserId,
    slack_channel_id: metadata.slackChannelId || null,
    slack_thread_ts: metadata.slackThreadTs || null,
    slack_message_ts: metadata.slackMessageTs || null,
    slack_source_channel_id: metadata.slackSourceChannelId || null,
    slack_source_thread_ts: metadata.slackSourceThreadTs || null,
    slack_source_message_ts: metadata.slackSourceMessageTs || null,
    flow_type: metadata.flowType || "general",
    current_step: metadata.currentStep || null,
    status: metadata.status || "active",
    request_id: metadata.requestId || null,
    expires_at: metadata.expiresAt || null,
    updated_at: new Date().toISOString(),
  };
}

export function buildSlackUsageEventRow(value: SlackDurableInteractionMetadata) {
  assertSlackDurableInteractionMetadata(value);
  if (!value.eventType) throw new Error("Slack zero-copy usage events require eventType.");
  return {
    beckett_user_id: value.beckettUserId || null,
    slack_team_id: value.slackTeamId,
    slack_user_id: value.slackUserId,
    event_type: value.eventType,
    flow_type: value.flowType || null,
    request_id: value.requestId || null,
    credits_charged: value.creditsCharged || 0,
    success: value.success ?? true,
    error_code: value.errorCode || null,
    latency_ms: value.latencyMs ?? null,
    search_available: value.searchAvailable ?? null,
    occurred_at: value.occurredAt || new Date().toISOString(),
  };
}

function scrubSafeTelemetryValue(key: string, value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if ((BOOLEAN_KEYS.has(key) || key === "rateLimited") && typeof value === "boolean") return value;
  if ((NUMBER_KEYS.has(key) || ["attempt", "httpStatus", "retryAfterMs"].includes(key)) && (
    typeof value === "number" && Number.isFinite(value) && value >= 0
  )) return value;
  if (["occurredAt", "expiresAt"].includes(key) && typeof value === "string" && !Number.isNaN(Date.parse(value)) && value.length <= 40) return value;
  if (OPAQUE_IDENTIFIER_KEYS.has(key) && isOpaqueValue(value)) return value;
  if ((CODE_KEYS.has(key) || key === "method" || key === "operation") && isCodeValue(value)) return value;
  if (key === "flowType" && FLOW_TYPES.has(value as SlackZeroCopyFlowType)) return value;
  if (key === "status" && FLOW_STATUSES.has(value as SlackZeroCopyFlowStatus)) return value;
  if (key === "grantedScopes" && Array.isArray(value) && value.every((item) => SCOPE_PATTERN.test(String(item)))) {
    return [...value];
  }
  return SLACK_ZERO_COPY_FILTERED;
}

export function scrubSlackTelemetry(value: unknown): unknown {
  if (!isRecord(value)) return SLACK_ZERO_COPY_FILTERED;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      TELEMETRY_SAFE_KEYS.has(key) ? scrubSafeTelemetryValue(key, nested) : SLACK_ZERO_COPY_FILTERED,
    ])
  );
}
