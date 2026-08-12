import assert from "node:assert/strict";
import test from "node:test";

import { safeErrorCode, structuredLogRecord } from "../lib/structured-logger.ts";

test("structured logs retain operational fields and discard sensitive context", () => {
  const record = structuredLogRecord("error", "Slack request failed", {
    route: "/api/slack/events",
    status: 500,
    userId: "user-secret",
    email: "person@example.com",
    prompt: "private message body",
    token: "oauth-secret",
  });
  const serialized = JSON.stringify(record);
  assert.equal(record.event, "Slack_request_failed");
  assert.equal(record.route, "/api/slack/events");
  assert.equal(record.status, 500);
  assert.doesNotMatch(serialized, /user-secret|example\.com|private message body|oauth-secret/);
});

test("error codes expose stable codes but not arbitrary exception messages", () => {
  assert.equal(safeErrorCode(new Error("slack_api_failed")), "slack_api_failed");
  assert.equal(safeErrorCode(new Error("token=secret for person@example.com")), "unexpected_error");
});
