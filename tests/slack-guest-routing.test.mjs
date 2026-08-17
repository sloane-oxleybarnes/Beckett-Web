import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGuestSlashCoachingPrompt,
  extractGuestPrepOutcomeAndConcern,
  guestPracticeOpening,
  guestStarterIntent,
  inferGuestPrepLocation,
  initialPrepOutcomeAndConcern,
  nextMissingPrepDetail,
  shouldLoadGuestConversationContext,
} from "../lib/slack-guest-routing.ts";
import { shouldScheduleSlackInactivityStartCard } from "../lib/slack-inactivity-policy.ts";

test("starter prompts route deterministically without Prep fallback", () => {
  assert.equal(guestStarterIntent("Help me decode a Slack message."), "decode");
  assert.equal(guestStarterIntent("Help me draft a response to a Slack message."), "respond");
  assert.equal(guestStarterIntent("Help me rewrite a draft."), "rewrite");
  assert.equal(guestStarterIntent("Help me prepare for a difficult conversation."), "prep");
});

test("fresh explicit slash requests do not load unrelated DM history", () => {
  assert.equal(shouldLoadGuestConversationContext({}), false);
  assert.equal(shouldLoadGuestConversationContext({ selectedMessageText: "Fine." }), true);
  assert.equal(shouldLoadGuestConversationContext({ threadTs: "123.456" }), true);
  assert.equal(shouldLoadGuestConversationContext({ latestMessageText: "Latest message" }), true);
});

test("Respond and Rewrite require immediate usable output", () => {
  const respond = buildGuestSlashCoachingPrompt("respond", "Can you send it today?");
  assert.match(respond, /exactly three/i);
  assert.match(respond, /Confirm, Negotiate, and Clarify/);
  assert.match(respond, /Do not ask a setup question/i);

  const rewrite = buildGuestSlashCoachingPrompt("rewrite", "I already told you this.");
  assert.match(rewrite, /Preserve the user's meaning, request, and boundaries/);
  assert.match(rewrite, /Exact draft: I already told you this\./);
});

test("Prep extracts an explicit concern instead of asking for it again", () => {
  const result = extractGuestPrepOutcomeAndConcern(
    "I want us to agree on priorities so the workload is realistic. I'm worried they'll think I can't prioritize. Where do you think I should have this conversation?"
  );
  assert.equal(result.outcome, "I want us to agree on priorities so the workload is realistic.");
  assert.equal(result.concern, "I'm worried they'll think I can't prioritize.");
  assert.deepEqual(extractGuestPrepOutcomeAndConcern("I want clearer priorities."), {
    outcome: "I want clearer priorities.",
    concern: null,
  });
  assert.equal(
    extractGuestPrepOutcomeAndConcern("I want alignment. I’m concerned they’ll dismiss it.").concern,
    "I’m concerned they’ll dismiss it."
  );
  const liveFailure = extractGuestPrepOutcomeAndConcern(
    "I want us to agree on priorities so the workload is realistic. I am worried they will think I cannot prioritize or handle my role."
  );
  assert.equal(liveFailure.outcome, "I want us to agree on priorities so the workload is realistic.");
  assert.equal(liveFailure.concern, "I am worried they will think I cannot prioritize or handle my role.");
});

test("complete one-message Prep extracts only the requested outcome", () => {
  const result = extractGuestPrepOutcomeAndConcern(
    "I need to talk to my manager about workload during our Zoom 1:1. I want us to agree on priorities so the workload is realistic. I am worried they will think I cannot prioritize or handle my role."
  );
  assert.equal(result.outcome, "I want us to agree on priorities so the workload is realistic.");
  assert.equal(result.concern, "I am worried they will think I cannot prioritize or handle my role.");
  assert.equal(inferGuestPrepLocation("during our Zoom 1:1"), "call");
});

test("Prep recognizes common concern variants independently from outcome", () => {
  for (const concern of [
    "I worry they will say everyone is busy.",
    "I'm worried they will say everyone is busy.",
    "I fear they will reject it.",
    "They may say there is no budget.",
    "I expect pushback about timing.",
  ]) {
    const result = extractGuestPrepOutcomeAndConcern(`I want agreement on new dates. ${concern}`);
    assert.equal(result.outcome, "I want agreement on new dates.");
    assert.ok(result.concern);
  }
  assert.equal(
    initialPrepOutcomeAndConcern("I want agreement on new dates.").outcome,
    "I want agreement on new dates."
  );
});

test("exact Prep reproduction skips supplied outcome and concern and asks only for location", () => {
  const details = initialPrepOutcomeAndConcern(
    "I need to ask my manager tomorrow to move two deadlines because my workload is too high; I want agreement on new dates and I worry they will say everyone is busy."
  );
  assert.equal(details.outcome, "I want agreement on new dates");
  assert.equal(details.concern, "I worry they will say everyone is busy.");
  assert.equal(nextMissingPrepDetail({ person: "my manager", ...details }), "location");
  assert.equal(nextMissingPrepDetail({ person: "my manager", location: "call", ...details }), null);
});

test("Prep advances to the first genuinely missing field", () => {
  assert.equal(nextMissingPrepDetail({}), "person");
  assert.equal(nextMissingPrepDetail({ person: "manager" }), "location");
  assert.equal(nextMissingPrepDetail({ person: "manager", location: "call" }), "outcome");
  assert.equal(nextMissingPrepDetail({ person: "manager", location: "call", outcome: "agreement" }), "concern");
});

test("active Slack coaching never schedules unsolicited start menus", () => {
  assert.equal(shouldScheduleSlackInactivityStartCard(), false);
});

test("Practice starts in character without asking which version of the person to play", () => {
  assert.equal(guestPracticeOpening("your manager", "call"), "Hey, I have a few minutes—what's on your mind?");
  assert.doesNotMatch(guestPracticeOpening("your manager", "call"), /actual|general/i);
});
