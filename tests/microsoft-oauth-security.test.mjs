import assert from "node:assert/strict";
import test from "node:test";
import { decryptOAuthToken, encryptOAuthToken } from "../lib/oauth-token-crypto.ts";

test("Microsoft OAuth tokens round-trip through authenticated encryption", () => {
  const previous = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY;
  process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const encrypted = encryptOAuthToken("private-token-value");
    assert.notEqual(encrypted, "private-token-value");
    assert.match(encrypted, /^v1\./);
    assert.equal(decryptOAuthToken(encrypted), "private-token-value");
  } finally {
    if (previous === undefined) delete process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY;
    else process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test("Microsoft OAuth encryption rejects ambiguous key material", () => {
  const previous = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY;
  process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY = "not-a-production-key";
  try {
    assert.throws(() => encryptOAuthToken("private-token-value"), /32-byte base64 or 64-character hex/);
  } finally {
    if (previous === undefined) delete process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY;
    else process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY = previous;
  }
});
