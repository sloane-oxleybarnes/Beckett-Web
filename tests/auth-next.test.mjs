import assert from "node:assert/strict";
import test from "node:test";
import { profileSetupPath, safeInternalPath } from "../lib/auth-next.ts";

test("preserves an internal Gmail account-link return path", () => {
  const next = "/auth/google-workspace-addon/connect?token=abc123";
  assert.equal(safeInternalPath(next), next);
  assert.equal(
    profileSetupPath(next),
    `/auth/profile-setup?next=${encodeURIComponent(next)}`,
  );
});

test("rejects external and protocol-relative auth redirects", () => {
  assert.equal(safeInternalPath("https://example.com"), null);
  assert.equal(safeInternalPath("//example.com/path"), null);
  assert.equal(safeInternalPath("/\\example.com/path"), null);
});

test("uses profile setup as the default onboarding destination", () => {
  assert.equal(profileSetupPath(null), "/auth/profile-setup");
});
