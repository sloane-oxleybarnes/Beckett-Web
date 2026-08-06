import assert from "node:assert/strict";
import test from "node:test";

import { gmailOpenCreatedDraftAction } from "../lib/google-workspace-gmail-action.ts";

test("returns Google's HTTP add-on action for opening a newly created Gmail draft", () => {
  const action = gmailOpenCreatedDraftAction("r123", "15e9fa622ce1029d");

  assert.deepEqual(action, {
    hostAppAction: {
      gmailAction: {
        openCreatedDraftActionMarkup: {
          draftId: "r123",
          draftThreadId: "15e9fa622ce1029d",
        },
      },
    },
  });
  assert.equal("openCreatedDraftAction" in action.hostAppAction.gmailAction, false);
  assert.equal(action.hostAppAction.gmailAction.openCreatedDraftActionMarkup.draftId.startsWith("msg-a:"), false);
  assert.equal(action.hostAppAction.gmailAction.openCreatedDraftActionMarkup.draftThreadId.startsWith("thread-f:"), false);
});

test("rejects incomplete Gmail draft identifiers", () => {
  assert.throws(() => gmailOpenCreatedDraftAction("", "15e9fa622ce1029d"), /gmail_draft_response_invalid/);
  assert.throws(() => gmailOpenCreatedDraftAction("r123", ""), /gmail_draft_response_invalid/);
});
