import assert from "node:assert/strict";
import test from "node:test";

import {
  isReminderKind,
  reminderKindCopy,
  workdayPlanDate,
} from "../lib/workday-planning.ts";

test("only supported reminder kinds can be saved", () => {
  assert.equal(isReminderKind("check_in"), true);
  assert.equal(isReminderKind("reset"), true);
  assert.equal(isReminderKind("review_plan"), true);
  assert.equal(isReminderKind("calendar_write"), false);
  assert.equal(isReminderKind(undefined), false);
});

test("reminder copy points users to a user-controlled surface", () => {
  for (const copy of Object.values(reminderKindCopy)) {
    assert.match(copy.href, /^(#today-checkin|\/dashboard\/about#support-preferences)$/);
    assert.ok(copy.nudge.includes("dismiss"));
  }
});

test("a daily focus uses the local calendar date", () => {
  assert.equal(workdayPlanDate(new Date("2026-07-30T01:30:00-07:00")), "2026-07-30");
});
