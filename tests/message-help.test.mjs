import assert from "node:assert/strict";
import test from "node:test";
import { isMessageHelpAction, messageHelpActions, messageHelpTask } from "../lib/message-help.ts";

test("message help exposes the four generated actions used by the shared workspace", () => {
  assert.deepEqual(messageHelpActions, ["decode", "respond", "rewrite", "prep"]);
  for (const action of messageHelpActions) {
    assert.equal(isMessageHelpAction(action), true);
    assert.ok(messageHelpTask(action).length > 40);
  }
  assert.equal(isMessageHelpAction("practice"), false);
});

test("each generated action has distinct coaching instructions", () => {
  assert.equal(new Set(messageHelpActions.map(messageHelpTask)).size, messageHelpActions.length);
  assert.match(messageHelpTask("decode"), /ambigu/i);
  assert.match(messageHelpTask("respond"), /ready-to-send/i);
  assert.match(messageHelpTask("rewrite"), /Preserve/i);
  assert.match(messageHelpTask("prep"), /opening line/i);
});
