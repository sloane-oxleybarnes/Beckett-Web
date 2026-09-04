import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public Slack journey preserves guest installation and warns before OAuth", () => {
  const landing = read("app/slack/page.tsx");
  const confirmation = read("app/slack/install/page.tsx");
  const installRoute = read("app/api/slack/install/route.ts");
  const callback = read("app/api/slack/callback/route.ts");

  assert.match(landing, /No Beckett account required/);
  assert.match(landing, /App is not approved by Slack/);
  assert.match(landing, /href="\/slack\/install"/);
  assert.doesNotMatch(landing, /href="\/api\/slack\/install"/);

  assert.match(confirmation, /Final review before Slack/);
  assert.match(confirmation, /App is not approved by Slack/);
  assert.match(confirmation, /"\/api\/slack\/install"/);
  assert.match(confirmation, /"\/api\/slack\/connect"/);

  assert.match(installRoute, /purpose: "install"/);
  assert.doesNotMatch(installRoute, /getAuthenticatedContext|auth\.getUser/);
  assert.match(callback, /state\.purpose === "connect"/);
  assert.match(callback, /installerUserId: user\?\.id \|\| null/);
});

test("Slack acquisition and support disclose permissions, routing, admin approval, and credits", () => {
  const copy = read("lib/slack-install-copy.ts");
  const support = read("app/support/page.tsx");
  const home = read("app/slack/page.tsx");
  const integrations = read("app/integrations/page.tsx");
  const apps = read("components/dashboard/AppsPanel.tsx");
  const connectedApps = read("lib/connected-apps.ts");

  for (const scope of ["commands", "chat:write", "assistant:write", "im:history", "im:write", "users:read"]) {
    assert.match(copy, new RegExp(`scope: "${scope.replace(":", "\\:")}"`));
  }
  assert.match(support, /private Beckett conversation/);
  assert.match(support, /workspace owner or administrator/);
  assert.match(support, /Guest credits work immediately/);
  assert.match(support, /Upgrade\/relink/);
  assert.match(home, /Install Beckett for Slack/);
  assert.match(integrations, /Install Beckett for Slack/);
  assert.match(connectedApps, /\/slack\/install\?mode=connect/);
  assert.doesNotMatch(apps, /href="\/api\/slack\/connect"/);
});

test("Workday Reminders stay dormant", () => {
  const appAndComponentSources = [
    "app/dashboard/settings/page.tsx",
    "components/dashboard/SettingsPanel.tsx",
    "components/dashboard/TodayGuide.tsx",
    "components/dashboard/WorkdayCheckinCard.tsx",
  ].map(read).join("\n");

  assert.doesNotMatch(appAndComponentSources, /<WorkdayReminders|href=["'][^"']*workday-reminders/);
  assert.match(read("components/dashboard/WorkdayReminders.tsx"), /id="workday-reminders"/);
});
