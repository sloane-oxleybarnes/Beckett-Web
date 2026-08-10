export type WorkspaceAddOnVerificationStage =
  | "event_parse"
  | "system_token_verification"
  | "account_resolution"
  | "handler"
  | "response";

export type WorkspaceAddOnResponseType = "render_action" | "json_error";

const SAFE_REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function workspaceAddOnRequestId(candidate?: string | null) {
  const trimmed = candidate?.trim() || "";
  if (SAFE_REQUEST_ID.test(trimmed)) return trimmed;
  return crypto.randomUUID();
}

export function workspaceAddOnErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "workspace_addon_error";
  if (message === "invalid_event") return "invalid_event";
  if (message === "missing_system_token") return "missing_system_token";
  if (message === "invalid_system_token") return "invalid_system_token";
  if (message === "missing_user_token") return "missing_user_token";
  if (message === "invalid_user_token") return "invalid_user_token";
  if (/not configured/.test(message)) return "configuration_missing";
  if (message === "gmail_authorization_missing" || message === "gmail_api_error:403") {
    return "gmail_token_unavailable";
  }
  if (/^gmail_api_error:\d{3}$/.test(message)) return "gmail_api_error";
  return "workspace_addon_error";
}

export function workspaceAddOnErrorStatus(errorCode: string, stage: WorkspaceAddOnVerificationStage) {
  if (errorCode === "configuration_missing") return 503;
  if (
    errorCode === "invalid_event" ||
    errorCode === "missing_system_token" ||
    errorCode === "invalid_system_token" ||
    errorCode === "missing_user_token" ||
    errorCode === "invalid_user_token"
  ) {
    return 401;
  }
  return stage === "handler" || stage === "account_resolution" ? 500 : 401;
}

export function isExpectedWorkspaceAnalysisCacheSkip(error: unknown) {
  return workspaceAddOnErrorCode(error) === "gmail_token_unavailable";
}

export function workspaceAddOnLogRecord(input: {
  route: string;
  requestId: string;
  stage: WorkspaceAddOnVerificationStage;
  status: number;
  responseType: WorkspaceAddOnResponseType;
  event: string;
  errorCode?: string;
}) {
  return {
    source: "google_workspace_addon",
    event: input.event,
    route: input.route,
    requestId: input.requestId,
    stage: input.stage,
    status: input.status,
    responseType: input.responseType,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  };
}
