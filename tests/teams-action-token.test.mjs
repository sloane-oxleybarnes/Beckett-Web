import assert from "node:assert/strict";
import test from "node:test";

process.env.MICROSOFT_TEAMS_ACTION_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");

const {
  decryptTeamsActionToken,
  encryptTeamsActionToken,
  teamsActionRequestId,
} = await import("../lib/teams-action-token.ts");

test("Teams action token encrypts selected content and expires quickly", () => {
  const before = Date.now();
  const token = encryptTeamsActionToken({
    activityId: "activity-1",
    aadObjectId: "aad-1",
    tenantId: "tenant-1",
    intent: "decode",
    messageText: "Sensitive selected message",
  });
  assert.doesNotMatch(token, /Sensitive|selected|message/);

  const payload = decryptTeamsActionToken(token, before + 1_000);
  assert.equal(payload.messageText, "Sensitive selected message");
  assert.equal(payload.requestId, teamsActionRequestId("activity-1", "decode"));
  assert.throws(() => decryptTeamsActionToken(token, before + 6 * 60 * 1_000), /expired/);
});

test("Teams action token rejects tampering and malformed values", () => {
  const token = encryptTeamsActionToken({
    activityId: "activity-2",
    aadObjectId: "aad-2",
    tenantId: null,
    intent: "draft",
    messageText: "Draft this",
  });
  assert.throws(() => decryptTeamsActionToken(`${token.slice(0, -1)}x`));
  assert.throws(() => decryptTeamsActionToken("not-a-token"));
});
