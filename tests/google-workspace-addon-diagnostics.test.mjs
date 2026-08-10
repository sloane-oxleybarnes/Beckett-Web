import assert from "node:assert/strict";
import test from "node:test";

import {
  isExpectedWorkspaceAnalysisCacheSkip,
  workspaceAddOnErrorCode,
  workspaceAddOnErrorStatus,
  workspaceAddOnLogRecord,
  workspaceAddOnRequestId,
} from "../lib/google-workspace-addon-diagnostics.ts";

test("accepts only bounded privacy-safe correlation IDs", () => {
  const existing = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(workspaceAddOnRequestId(existing), existing);
  assert.match(workspaceAddOnRequestId("email@example.com token=secret"), /^[0-9a-f-]{36}$/);
  assert.match(workspaceAddOnRequestId("opaque-secret-that-looks-like-an-id"), /^[0-9a-f-]{36}$/);
});

test("maps raw failures to stable safe error codes and statuses", () => {
  assert.equal(workspaceAddOnErrorCode(new Error("GOOGLE_WORKSPACE_ADDON_CLIENT_ID is not configured")), "configuration_missing");
  assert.equal(workspaceAddOnErrorStatus("configuration_missing", "system_token_verification"), 503);
  assert.equal(workspaceAddOnErrorCode(new Error("invalid_system_token")), "invalid_system_token");
  assert.equal(workspaceAddOnErrorStatus("invalid_system_token", "system_token_verification"), 401);
  assert.equal(workspaceAddOnErrorStatus("workspace_addon_error", "handler"), 500);
});

test("treats Gmail's contextual-prefetch 403 as an expected cache skip", () => {
  assert.equal(isExpectedWorkspaceAnalysisCacheSkip(new Error("gmail_api_error:403")), true);
  assert.equal(isExpectedWorkspaceAnalysisCacheSkip(new Error("gmail_authorization_missing")), true);
  assert.equal(isExpectedWorkspaceAnalysisCacheSkip(new Error("gmail_api_error:500")), false);
});

test("structured records exclude tokens, email addresses, and message content", () => {
  const rawError = new Error("token=secret email@example.com draft: confidential message");
  const record = workspaceAddOnLogRecord({
    route: "/api/google-workspace-addon/message",
    requestId: "123e4567-e89b-42d3-a456-426614174000",
    stage: "handler",
    status: 500,
    responseType: "json_error",
    event: "request_failed",
    errorCode: workspaceAddOnErrorCode(rawError),
  });
  const serialized = JSON.stringify(record);

  assert.deepEqual(Object.keys(record), [
    "source",
    "event",
    "route",
    "requestId",
    "stage",
    "status",
    "responseType",
    "errorCode",
  ]);
  assert.doesNotMatch(serialized, /secret|example\.com|confidential message/);
  assert.equal(record.errorCode, "workspace_addon_error");
});
