import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Chrome has no Gmail host permission or Gmail content script", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.equal(manifest.host_permissions.some((permission) => permission.includes("mail.google.com")), false);
  assert.equal(
    manifest.content_scripts.some((script) => script.matches.some((match) => match.includes("mail.google.com"))),
    false,
  );
});

test("the website exposes Calendar OAuth but no standalone Gmail OAuth", () => {
  const connectedApps = read("lib/connected-apps.ts");
  assert.match(connectedApps, /GOOGLE_WORKSPACE_MARKETPLACE_URL/);
  assert.doesNotMatch(connectedApps, /api\/gmail\/oauth/);
  assert.doesNotMatch(connectedApps, /gmail\.readonly/);
  assert.match(connectedApps, /api\/calendar\/oauth\/start/);
});

test("selected Gmail contact enrichment does not consume another coaching credit", () => {
  const contactRoute = read("app/api/google-workspace-addon/contact/route.ts");
  assert.match(contactRoute, /loadWorkspaceAnalysisCache/);
  assert.match(contactRoute, /recordSafeInteractionSummary/);
  assert.doesNotMatch(contactRoute, /recordSuccessfulWebCredit|recordAiUsage|callAnthropic/);
});

test("disconnecting the Gmail add-on prevents immediate email-based relinking", () => {
  const resolver = read("lib/google-workspace-addon.ts");
  const disconnectRoute = read("app/api/integrations/[provider]/route.ts");
  const explicitLink = read("lib/google-workspace-addon-link.ts");
  assert.match(disconnectRoute, /google_workspace_addon_disabled/);
  assert.match(resolver, /google_workspace_addon_disabled/);
  assert.match(explicitLink, /delete\(\)[\s\S]*google_workspace_addon_disabled/);
});
