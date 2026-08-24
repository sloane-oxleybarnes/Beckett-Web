import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsSource = await readFile(
  new URL("../components/dashboard/SettingsPanel.tsx", import.meta.url),
  "utf8",
);
const aboutSource = await readFile(
  new URL("../app/dashboard/about/page.tsx", import.meta.url),
  "utf8",
);

test("Settings edits and saves the shared coaching rating maps", () => {
  assert.match(settingsSource, /coachingPriorityRatingOptions/);
  assert.match(settingsSource, /coachingStyleRatingOptions/);
  assert.match(settingsSource, /coaching_priority_ratings: coachingPriorityRatings/);
  assert.match(settingsSource, /coaching_style_ratings: coachingStyleRatings/);
  assert.match(settingsSource, /disabled=\{!coachingRatingsComplete\}/);
});

test("About Me edits and saves the shared strengths and effort rating maps", () => {
  assert.match(aboutSource, /strengthRatingOptions/);
  assert.match(aboutSource, /workplaceEffortRatingOptions/);
  assert.match(aboutSource, /communication_strength_ratings: strengthRatings/);
  assert.match(aboutSource, /workplace_effort_ratings: workplaceEffortRatings/);
  assert.doesNotMatch(aboutSource, /title="My Triggers"/);
});
