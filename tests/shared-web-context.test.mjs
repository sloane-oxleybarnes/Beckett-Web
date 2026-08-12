import assert from "node:assert/strict";
import test from "node:test";

import {
  SHARED_WEB_CONTEXT_SURFACES,
  buildSharedWebContext,
} from "../lib/shared-web-context.ts";

test("shared context exposes only safe account-level status to the web", () => {
  const context = buildSharedWebContext({
    profile: {
      full_name: "Avery Example",
      communication_preferences: ["Clear next steps"],
      strengths: ["Thoughtful"],
      workplace_triggers: ["Unexpected calls"],
      pattern_model_enabled: true,
      skill_recommendations_enabled: true,
      meeting_prep_learning_enabled: true,
      home_suggestions_enabled: true,
      proactive_coaching_preference: "quiet_prompt",
      safety_resource_region: "CA",
      meeting_retention_preference: "notes_only",
    },
    toolkitItems: [{ label: "Clarifying question", content: "Can you share the decision owner?" }],
    integrations: [{ provider: "google_workspace_addon" }, { provider: "google_calendar" }],
    contactCount: 3,
    activeSupportPlanCount: 1,
  });

  assert.deepEqual(context.surfaces, SHARED_WEB_CONTEXT_SURFACES);
  assert.equal(context.connectedTools.gmail, true);
  assert.equal(context.connectedTools.calendar, true);
  assert.equal(context.choices.privatePatternLearning, true);
  assert.equal(context.choices.skillRecommendations, true);
  assert.equal(context.choices.meetingPrepLearning, true);
  assert.equal(context.choices.proactivity, "gentle_notifications");
  assert.equal(context.choices.safetyRegion, "CA");
  assert.equal(context.retention.meetingPreference, "notes_only");
  assert.equal(context.savedContext.contacts, 3);
  assert.match(context.promptContext, /Clear next steps/);
  assert.match(context.promptContext, /Do not mention this context unprompted/);
});

test("private learning controls gate downstream recommendations", () => {
  const context = buildSharedWebContext({
    profile: {
      pattern_model_enabled: false,
      skill_recommendations_enabled: true,
      meeting_prep_learning_enabled: true,
    },
  });

  assert.equal(context.choices.privatePatternLearning, false);
  assert.equal(context.choices.skillRecommendations, false);
  assert.equal(context.choices.meetingPrepLearning, false);
  assert.equal(context.retention.workdayLearning, "off");
});

test("the AI prompt never claims access to integrations or raw service data", () => {
  const context = buildSharedWebContext({
    profile: { full_name: "Avery Example" },
    integrations: [{ provider: "google_workspace_addon" }, { provider: "google_calendar" }],
  });

  assert.doesNotMatch(context.promptContext, /gmail|calendar|oauth|token/i);
});
