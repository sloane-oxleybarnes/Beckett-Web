import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRelationshipTag,
  normalizeRelationshipTags,
  primaryRelationshipTagForContact,
  relationshipLabelForContact,
  relationshipTagsForContact,
} from "../lib/relationship-tags.ts";

test("preserves multiple unique relationship tags in their selected order", () => {
  assert.deepEqual(
    normalizeRelationshipTags(["manager", "mentor", "manager", " ", "not/valid"]),
    ["manager", "mentor"]
  );
});

test("uses a valid selected primary tag and falls back safely", () => {
  const contact = { relationship_tags: ["colleague", "mentor"], primary_relationship_tag: "mentor" };
  assert.equal(primaryRelationshipTagForContact(contact), "mentor");
  assert.equal(relationshipLabelForContact(contact), "Mentor, Colleague");
  assert.equal(
    primaryRelationshipTagForContact({ relationship_tags: ["colleague"], primary_relationship_tag: "manager" }),
    "colleague"
  );
});

test("keeps existing single relationship data usable as tags", () => {
  assert.deepEqual(relationshipTagsForContact({ relationship_type: "Direct report" }), ["direct_report"]);
  assert.deepEqual(relationshipTagsForContact({ relationship_type: "Other", relationship_other: "Agency partner" }), ["agency partner"]);
});

test("normalizes user-managed tag keys without allowing unsafe values", () => {
  assert.equal(normalizeRelationshipTag("Accountability Partner"), "accountability partner");
  assert.equal(normalizeRelationshipTag("not/allowed"), null);
});
