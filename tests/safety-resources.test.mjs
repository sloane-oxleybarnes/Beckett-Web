import test from "node:test";
import assert from "node:assert/strict";
import {
  allSafetyResources,
  getSafetyResponse,
  getSafetyReviewStatus,
  normalizeSafetyResourceRegion,
  safetyResourceRegions,
} from "../lib/safety-resources.ts";

test("every supported region has a complete four-topic resource set", () => {
  for (const region of safetyResourceRegions) {
    const resources = allSafetyResources(region.value);
    assert.deepEqual(resources.map((resource) => resource.topic), ["crisis", "relationship_safety", "health", "legal"]);
    assert.ok(resources.every((resource) => resource.resources.length > 0));
    assert.ok(resources.every((resource) => resource.owner));
    assert.ok(resources.every((resource) => resource.reviewedAt && resource.nextReviewAt));
  }
});

test("regional routing uses local resource sets and labels the international fallback", () => {
  const canada = allSafetyResources("CA").find((resource) => resource.topic === "crisis");
  assert.equal(canada.regionLabel, "Canada");
  assert.equal(canada.usingUSFallback, false);
  assert.match(canada.resources[0].label, /Canada/i);

  const other = allSafetyResources("OTHER").find((resource) => resource.topic === "crisis");
  assert.equal(other.usingUSFallback, true);
  assert.match(other.message, /local emergency services/i);
  assert.equal(other.emergencyNumber, "your local emergency number");
});

test("safety detection preserves the selected region", () => {
  const response = getSafetyResponse("I am in immediate danger and cannot keep myself safe.", "AU");
  assert.equal(response.topic, "crisis");
  assert.equal(response.region, "AU");
  assert.equal(response.emergencyNumber, "000");

  const legal = getSafetyResponse("I need legal advice about a discrimination claim.", "GB");
  assert.equal(legal.topic, "legal");
  assert.match(legal.resources[0].label, /ACAS/i);
});

test("unknown regions safely normalize to the reviewed U.S. default", () => {
  assert.equal(normalizeSafetyResourceRegion("DE"), "US");
  assert.equal(normalizeSafetyResourceRegion(null), "US");
});

test("review status distinguishes current, due-soon, and overdue content", () => {
  assert.equal(getSafetyReviewStatus("2026-07-22", "2026-10-20", new Date("2026-07-30T12:00:00Z")), "current");
  assert.equal(getSafetyReviewStatus("2026-01-01", "2026-08-05", new Date("2026-07-30T12:00:00Z")), "due");
  assert.equal(getSafetyReviewStatus("2026-01-01", "2026-07-01", new Date("2026-07-30T12:00:00Z")), "overdue");
});
