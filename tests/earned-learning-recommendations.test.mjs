import assert from "node:assert/strict";
import test from "node:test";

import { findEarnedLearningRecommendation } from "../lib/earned-learning-recommendations.ts";

const claritySession = (suffix) => ({ situation: `Clarify the project scope ${suffix}`, goal: "Ask a clear follow-up question" });
const generalSession = { situation: "Plan a focused work block", goal: "Choose one next step" };

function signals(overrides = {}) {
  return {
    sessions: [],
    unavailableCourseIds: new Set(),
    completedCourseIds: new Set(),
    savedSupportPlanText: [],
    rememberedPatternText: [],
    ...overrides,
  };
}

test("does not suggest a skill before enough completed practice exists", () => {
  assert.equal(findEarnedLearningRecommendation(signals({ sessions: [claritySession("one"), claritySession("two")] })), null);
});

test("earns a course only after repeated, relevant completed practice", () => {
  const recommendation = findEarnedLearningRecommendation(signals({
    sessions: [claritySession("one"), claritySession("two"), generalSession],
  }));

  assert.equal(recommendation?.kind, "course");
  assert.equal(recommendation?.courseId, "asking-for-clarity");
  assert.equal(recommendation?.evidence.matchedPracticeSessions, 2);
  assert.match(recommendation?.why || "", /2 completed Practice sessions/);
});

test("allows an explicit saved preference to reinforce one relevant practice session", () => {
  const recommendation = findEarnedLearningRecommendation(signals({
    sessions: [claritySession("one"), generalSession],
    savedSupportPlanText: ["When a request is unclear, help me ask a clarifying question."],
  }));

  assert.equal(recommendation?.courseId, "asking-for-clarity");
  assert.equal(recommendation?.evidence.savedSupportPreference, true);
});

test("never recommends a course the user has already started or completed", () => {
  const recommendation = findEarnedLearningRecommendation(signals({
    sessions: [claritySession("one"), claritySession("two"), generalSession],
    unavailableCourseIds: new Set(["asking-for-clarity"]),
  }));

  assert.equal(recommendation, null);
});

test("uses an explicitly completed course to offer a linked practice next step", () => {
  const recommendation = findEarnedLearningRecommendation(signals({
    completedCourseIds: new Set(["asking-for-clarity"]),
    unavailableCourseIds: new Set(["asking-for-clarity"]),
  }));

  assert.equal(recommendation?.kind, "practice");
  assert.equal(recommendation?.courseId, "asking-for-clarity");
  assert.match(recommendation?.href || "", /^\/dashboard\/practice\?/);
});

test("does not use a raw check-in or an unrelated stored choice as a recommendation signal", () => {
  const recommendation = findEarnedLearningRecommendation(signals({
    sessions: [generalSession, { situation: "Tired at 3pm", goal: "Take a break" }],
    savedSupportPlanText: ["When I am tired, take a short walk."],
    rememberedPatternText: ["A break may help in the afternoon."],
  }));

  assert.equal(recommendation, null);
});
