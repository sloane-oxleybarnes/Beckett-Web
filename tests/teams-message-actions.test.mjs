import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTeamsTaskDialogResponse,
  normalizeTeamsSelectedMessage,
  parseTeamsMessageAction,
  TeamsMessageActionError,
} from "../features/teams/contracts.ts";

function activity(overrides = {}) {
  return {
    type: "invoke",
    name: "composeExtension/fetchTask",
    id: "teams-activity-1",
    channelId: "msteams",
    from: { id: "opaque-channel-user", aadObjectId: "aad-user-1" },
    conversation: { conversationType: "personal", tenantId: "tenant-1" },
    value: {
      commandId: "beckett_decode_selected",
      commandContext: "message",
      messagePayload: { body: { contentType: "html", content: "<p>Can you send this by 3?</p><p>Thanks &amp; let me know.</p>" } },
    },
    ...overrides,
  };
}

test("selected Teams HTML becomes bounded plain text", () => {
  assert.equal(
    normalizeTeamsSelectedMessage({ contentType: "html", content: "<p>Hello&nbsp;there</p><br><div>Next &lt;step&gt;</div>" }),
    "Hello there\n\nNext <step>",
  );
  assert.equal(normalizeTeamsSelectedMessage({ contentType: "text", content: "  hello   there  " }), "hello there");
  assert.equal(normalizeTeamsSelectedMessage({ contentType: "text", content: "x".repeat(9_000) }).length, 8_000);
});

test("only the two explicit message actions are accepted", () => {
  const decode = parseTeamsMessageAction(activity());
  assert.equal(decode.intent, "decode");
  assert.equal(decode.messageText, "Can you send this by 3?\nThanks & let me know.");
  assert.equal(decode.aadObjectId, "aad-user-1");

  const draft = parseTeamsMessageAction(activity({
    value: {
      ...activity().value,
      commandId: "beckett_draft_response",
    },
  }));
  assert.equal(draft.intent, "draft");

  assert.throws(
    () => parseTeamsMessageAction(activity({ value: { ...activity().value, commandId: "beckett_draft" } })),
    (error) => error instanceof TeamsMessageActionError && error.code === "unsupported_command",
  );
});

test("parser rejects non-message invokes, missing identity, and blank selected content", () => {
  assert.throws(
    () => parseTeamsMessageAction(activity({ channelId: "webchat" })),
    (error) => error.code === "unsupported_activity",
  );
  assert.throws(
    () => parseTeamsMessageAction(activity({ from: { id: "opaque-only" } })),
    (error) => error.code === "teams_identity_missing",
  );
  assert.throws(
    () => parseTeamsMessageAction(activity({
      text: "must not be used as a fallback",
      value: { ...activity().value, messagePayload: { body: { content: " " } } },
    })),
    (error) => error.code === "selected_message_missing",
  );
});

test("message action returns a private hosted dialog, never a conversation post", () => {
  const response = buildTeamsTaskDialogResponse("https://www.meetbeckett.co/teams/action#token=opaque", "decode");
  assert.equal(response.task.type, "continue");
  assert.equal(response.task.value.width, "medium");
  assert.match(response.task.value.url, /#token=opaque$/);
  assert.equal("composeExtension" in response, false);
  assert.equal("activity" in response, false);
});
