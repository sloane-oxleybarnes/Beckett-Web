import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildCoachingProfileBehavior,
  coachingToneContracts,
  formatCoachingProfileForPrompt,
} from "../lib/coaching-profile.ts";

const tones = [
  "direct_kind",
  "gentle_reassuring",
  "blunt_practical",
  "detailed_explanatory",
  "short_concise",
];

test("every coaching tone produces explicit behavioral instructions", () => {
  const prompts = tones.map((coaching_tone) => formatCoachingProfileForPrompt({ coaching_tone }));
  for (const prompt of prompts) assert.match(prompt, /Coaching style:/);
  assert.match(prompts[1], /emotional cushioning, validation, and low-shame framing/);
  assert.match(prompts[2], /lead with the bottom line/);
  assert.match(prompts[3], /social logic/);
  assert.match(prompts[4], /bottom line and the most useful next action/);
  assert.equal(new Set(prompts).size, tones.length);
});

test("Detailed coaching plus concise wording preserves detailed analysis and short user drafts", () => {
  const profile = {
    coaching_tone: "detailed_explanatory",
    communication_preferences: ["Being more concise", "Help me understand the social context"],
  };
  const behavior = buildCoachingProfileBehavior(profile);
  const prompt = formatCoachingProfileForPrompt(profile);

  assert.match(prompt, /detailed, explanatory coaching in compact bullets/);
  assert.match(prompt, /proposed message for the user short/);
  assert.match(prompt, /inside the normal analysis/);
  assert.deepEqual(behavior.instrumentation, {
    profileIncluded: true,
    tone: "detailed_explanatory",
    directiveIds: ["concise_drafts", "social_context"],
    preferenceCount: 2,
    responseLengthClass: "detailed",
  });
});

test("custom preferences apply even when a matching preset is not selected", () => {
  const behavior = buildCoachingProfileBehavior({
    coaching_tone: "blunt_practical",
    communication_preferences: ["Help me understand the social context"],
  });
  assert.deepEqual(behavior.instrumentation.directiveIds, ["social_context"]);
  assert.equal(behavior.instrumentation.preferenceCount, 1);
});

test("profile instrumentation is content-free and remains test-visible only", () => {
  const behavior = buildCoachingProfileBehavior({
    coaching_tone: "gentle_reassuring",
    communication_preferences: ["Being warmer in my responses"],
  });
  assert.deepEqual(Object.keys(behavior.instrumentation).sort(), [
    "directiveIds",
    "preferenceCount",
    "profileIncluded",
    "responseLengthClass",
    "tone",
  ]);
  assert.doesNotMatch(JSON.stringify(behavior.instrumentation), /private Slack content|generated draft|custom preference text/i);
});

test("matched Decode contracts make Short shortest and Detailed deepest", () => {
  const short = coachingToneContracts.short_concise;
  const blunt = coachingToneContracts.blunt_practical;
  const direct = coachingToneContracts.direct_kind;
  const gentle = coachingToneContracts.gentle_reassuring;
  const detailed = coachingToneContracts.detailed_explanatory;

  assert.ok(short.maximumWords < blunt.maximumWords);
  assert.ok(blunt.maximumWords < direct.maximumWords);
  assert.ok(direct.maximumWords < gentle.maximumWords);
  assert.ok(gentle.maximumWords < detailed.minimumWords);
  assert.ok(short.quickCharacterLimit < blunt.quickCharacterLimit);
  assert.ok(detailed.quickCharacterLimit > gentle.quickCharacterLimit);
});

test("tone contracts require observably different behavior, not just different labels", () => {
  assert.match(coachingToneContracts.gentle_reassuring.requirements.join(" "), /validate|cushioning|encouragement/i);
  assert.match(coachingToneContracts.blunt_practical.requirements.join(" "), /minimal reassurance|bottom line/i);
  assert.match(coachingToneContracts.detailed_explanatory.requirements.join(" "), /evidence|uncertain|social logic|why/i);
  assert.match(coachingToneContracts.short_concise.requirements.join(" "), /no.*speculation|only.*interpretation/i);
  assert.equal(new Set(tones.map((tone) => coachingToneContracts[tone].requirements.join(" "))).size, tones.length);
});

test("live profile evaluation is opt-in and uses only the fixed synthetic prompt", () => {
  const evaluator = readFileSync(new URL("../scripts/evaluate-slack-coaching-profiles.mjs", import.meta.url), "utf8");
  assert.match(evaluator, /SYNTHETIC_PROMPT/);
  assert.match(evaluator, /non-blocking by default/i);
  assert.match(evaluator, /--strict/);
  assert.doesNotMatch(evaluator, /slack_user_links|slack_flow_sessions|message history/i);
});
