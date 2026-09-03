import assert from "node:assert/strict";
import test from "node:test";

import { requireEnvValue, requireHttpUrl } from "../lib/env-validation.ts";

test("requireEnvValue trims valid values", () => {
  assert.equal(requireEnvValue({ TOKEN: "  secret  " }, "TOKEN"), "secret");
});

test("requireEnvValue identifies a missing variable", () => {
  assert.throws(
    () => requireEnvValue({ TOKEN: "   " }, "TOKEN"),
    /Missing required environment variable: TOKEN/,
  );
});

test("requireHttpUrl accepts HTTP URLs and returns their origin", () => {
  assert.equal(
    requireHttpUrl({ SITE_URL: "https://example.com/path" }, "SITE_URL"),
    "https://example.com",
  );
});

test("requireHttpUrl rejects malformed and non-HTTP URLs", () => {
  assert.throws(() => requireHttpUrl({ SITE_URL: "not a url" }, "SITE_URL"), /valid URL/);
  assert.throws(() => requireHttpUrl({ SITE_URL: "ftp://example.com" }, "SITE_URL"), /http or https/);
});
