import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Teams manifest exposes only two selected-message actions", () => {
  const manifest = JSON.parse(read("teams-app/manifest.template.json"));
  assert.equal(manifest.manifestVersion, "1.29");
  assert.deepEqual(manifest.permissions, ["identity"]);
  assert.equal(manifest.composeExtensions.length, 1);
  assert.equal(manifest.composeExtensions[0].composeExtensionType, "botBased");
  assert.deepEqual(
    manifest.composeExtensions[0].commands.map((command) => command.id),
    ["beckett_decode_selected", "beckett_draft_response", "beckett_rewrite_draft"],
  );
  for (const command of manifest.composeExtensions[0].commands.slice(0, 2)) {
    assert.deepEqual(command.context, ["message"]);
    assert.equal(command.type, "action");
    assert.equal(command.fetchTask, true);
  }
  assert.deepEqual(manifest.composeExtensions[0].commands[2].context, ["compose"]);
  assert.equal("authorization" in manifest.composeExtensions[0], false);
  assert.equal("webApplicationInfo" in manifest, false);
  assert.doesNotMatch(JSON.stringify(manifest), /Chat\.Read|ChannelMessage|messageTeamMembers|teamSettings|meeting|transcript/i);
});

test("Teams implementation is private, authenticated, and zero-copy by construction", () => {
  const app = read("features/teams/app.ts");
  const actionRoute = read("app/api/teams/action/route.ts");
  const page = read("app/teams/action/page.tsx");
  const coaching = read("features/teams/coaching.ts");

  assert.match(app, /dangerouslyAllowUnauthenticatedRequests: false/);
  assert.match(app, /MICROSOFT_TEAMS_APP_ID/);
  assert.match(app, /MICROSOFT_TEAMS_APP_SECRET/);
  assert.match(app, /[?&]token=/);
  assert.doesNotMatch(app, /send\(|reply\(|microsoftGraphRequest|chatMessage|serviceUrl/);
  assert.doesNotMatch(actionRoute, /\.insert\(|\.upsert\(|messageText.*metadata|trackBetaEvent/);
  assert.match(page, /does not save the selected Teams message or send anything for you/);
  assert.match(page, /Connect Microsoft 365 to continue/);
  assert.match(page, /I’ve connected Microsoft 365 — try again/);
  assert.match(page, /requestTeamsAction\(actionToken(?:,|\))/);
  assert.match(page, /Try this action again/);
  assert.match(page, /Check credits and try again/);
  assert.match(actionRoute, /teams_action_expired/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(page, /sendActivity|chat\.send|Graph/);
  assert.match(coaching, /metadata: \{ intent: input\.intent \}/);
  assert.doesNotMatch(coaching, /metadata: \{[^}]*messageText|email:/);
});
