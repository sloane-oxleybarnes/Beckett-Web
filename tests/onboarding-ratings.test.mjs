import assert from "node:assert/strict";
import test from "node:test";

import {
  coachingStyleDimensions,
  deriveLegacyCoachingProfile,
  hasCompleteRatingMap,
  normalizeRatingMap,
  strengthOptions,
  strengthRatingOptions,
} from "../lib/onboarding.ts";

test("rating maps keep only expected categories and allowed values", () => {
  const input = Object.fromEntries(strengthOptions.map((option) => [option, "often"]));
  input[strengthOptions[0]] = "not-a-real-rating";
  input["Unexpected category"] = "often";

  const normalized = normalizeRatingMap(
    input,
    strengthOptions,
    strengthRatingOptions.map((option) => option.value),
  );

  assert.equal(normalized["Unexpected category"], undefined);
  assert.equal(normalized[strengthOptions[0]], undefined);
  assert.equal(hasCompleteRatingMap(normalized, strengthOptions), false);
});

test("not sure yet counts as an answered category", () => {
  const ratings = Object.fromEntries(strengthOptions.map((option) => [option, "unsure"]));
  assert.equal(hasCompleteRatingMap(ratings, strengthOptions), true);
});

test("rated profiles derive compatible coaching fields", () => {
  const strengthRatings = Object.fromEntries(strengthOptions.map((option) => [option, "not_usually"]));
  strengthRatings[strengthOptions[1]] = "core_strength";
  const workplaceEffortRatings = { "Vague or unclear feedback": "a_lot" };
  const coachingPriorityRatings = { "Understanding the social context": "top_priority" };
  const coachingStyleRatings = Object.fromEntries(coachingStyleDimensions.map((option) => [option.id, "a_little"]));
  coachingStyleRatings.social_context_explanation = "more";

  const result = deriveLegacyCoachingProfile({
    strengthRatings,
    workplaceEffortRatings,
    coachingPriorityRatings,
    coachingStyleRatings,
  });

  assert.deepEqual(result.strengths, [strengthOptions[1]]);
  assert.deepEqual(result.workplaceTriggers, ["Vague or unclear feedback"]);
  assert.deepEqual(result.communicationPreferences, ["Understanding the social context"]);
  assert.equal(result.coachingTone, "detailed_explanatory");
});
