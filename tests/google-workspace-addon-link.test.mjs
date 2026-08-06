import assert from "node:assert/strict";
import test from "node:test";
import {
  createWorkspaceAddOnLinkToken,
  hashWorkspaceAddOnLinkToken,
  isWorkspaceAddOnLinkToken,
} from "../lib/google-workspace-addon-link-token.ts";

test("creates an opaque URL-safe one-time connection token", () => {
  const token = createWorkspaceAddOnLinkToken();
  assert.equal(token.length, 43);
  assert.equal(isWorkspaceAddOnLinkToken(token), true);
  assert.doesNotMatch(token, /[+/=]/);
});

test("stores only a stable SHA-256 hash of the connection token", () => {
  const token = createWorkspaceAddOnLinkToken();
  const hash = hashWorkspaceAddOnLinkToken(token);
  assert.equal(hash.length, 64);
  assert.equal(hash, hashWorkspaceAddOnLinkToken(token));
  assert.notEqual(hash, token);
});

test("rejects malformed connection tokens", () => {
  assert.equal(isWorkspaceAddOnLinkToken(""), false);
  assert.equal(isWorkspaceAddOnLinkToken("too-short"), false);
  assert.equal(isWorkspaceAddOnLinkToken("a".repeat(42) + "+"), false);
});
