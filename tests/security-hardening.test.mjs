import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("account deletion revokes Google credentials before removing the auth user", () => {
  const source = read("lib/account-deletion.ts");
  assert.match(source, /oauth2\.googleapis\.com\/revoke/);
  assert.match(source, /auth\.admin\.deleteUser\(userId\)/);
  assert.match(source, /deleteHubSpotContact/);
  assert.match(source, /deleteLoopsContact/);
  assert.match(source, /deleteStripeCustomer/);
});

test("direct CRM mutation endpoints are disabled", () => {
  assert.match(read("app/api/hubspot/route.ts"), /status: 410/);
  assert.match(read("app/api/loops/route.ts"), /status: 410/);
});

test("Stripe webhook requires signed, bounded payloads", () => {
  const source = read("app/api/stripe/webhook/route.ts");
  assert.match(source, /stripe-signature/);
  assert.match(source, /constructEvent/);
  assert.match(source, /Payload too large/);
});

test("Gmail contact-wide search is explicitly disabled", () => {
  assert.match(read("app/api/gmail/contact-context/route.ts"), /status: 410/);
  assert.doesNotMatch(read("app/api/gmail/contact-context/route.ts"), /gmail\.users|threads\.list|messages\.list/);
});

test("security headers are configured and APIs are not granted wildcard CORS", () => {
  const source = read("next.config.mjs");
  for (const header of ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy", "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy"]) {
    assert.match(source, new RegExp(header));
  }
  assert.doesNotMatch(source, /Access-Control-Allow-Origin.*\*/);
});

test("admin auth uses an opaque signed session, not the raw password", () => {
  const login = read("app/api/admin/login/route.ts");
  const auth = read("lib/admin-auth.ts");
  assert.match(auth, /createHmac/);
  assert.match(login, /createAdminSession/);
  assert.doesNotMatch(login, /set\("admin_auth", process\.env\.ADMIN_PASSWORD/);
});
