import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveSlackDiagnosticConnections,
  summarizeSlackConnections,
} from "../lib/slack-diagnostics.ts";
import { readFileSync } from "node:fs";

const activeLink = {
  slack_team_id: "T-HI",
  slack_user_id: "U-CLAIRE",
  linked_at: "2026-08-17T01:00:00Z",
  updated_at: "2026-08-17T01:00:00Z",
  disconnected_at: null,
};

const installation = {
  slack_team_id: "T-HI",
  encrypted_bot_access_token: "encrypted",
  encrypted_bot_refresh_token: "refresh",
  bot_token_expires_at: "2026-08-17T01:00:00Z",
  uninstalled_at: null,
  installed_at: "2026-08-17T01:00:00Z",
  updated_at: "2026-08-17T01:00:00Z",
};

test("exact modern Slack link plus usable matching installation is active", () => {
  const [connection] = resolveSlackDiagnosticConnections({ links: [activeLink], installations: [installation] });
  assert.equal(connection.state, "active");
  assert.equal(connection.connected, true);
  assert.equal(connection.teamId, "T-HI");
  assert.equal(connection.userId, "U-CLAIRE");
});

test("missing matching installation degrades the exact linked workspace", () => {
  const [connection] = resolveSlackDiagnosticConnections({
    links: [activeLink],
    installations: [{ ...installation, slack_team_id: "T-OTHER" }],
  });
  assert.equal(connection.state, "degraded");
  assert.equal(connection.connected, false);
});

test("disconnected modern links and legacy links have explicit states", () => {
  const connections = resolveSlackDiagnosticConnections({
    links: [{ ...activeLink, disconnected_at: "2026-08-17T02:00:00Z" }],
    installations: [installation],
    legacy: [{
      external_team_id: "T-OLD",
      external_team_name: "Old workspace",
      external_user_id: "U-OLD",
      connected_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }],
  });
  assert.equal(connections.find((item) => item.kind === "modern")?.state, "disconnected");
  assert.equal(connections.find((item) => item.kind === "legacy")?.message, "Legacy connection—upgrade required");
});

test("legacy duplicate does not override a modern exact team/user link", () => {
  const connections = resolveSlackDiagnosticConnections({
    links: [activeLink],
    installations: [installation],
    legacy: [{
      external_team_id: "T-HI",
      external_team_name: "hi",
      external_user_id: "U-CLAIRE",
      connected_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    }],
  });
  assert.equal(connections.length, 1);
  assert.equal(connections[0].teamName, "hi");
  assert.equal(connections[0].state, "active");
});

test("Apps summary reports connected workspaces and degraded workspaces together", () => {
  const connections = resolveSlackDiagnosticConnections({
    links: [activeLink],
    installations: [installation],
    legacy: [{
      external_team_id: "T-OLD",
      external_team_name: "Old workspace",
      external_user_id: "U-OLD",
      connected_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    }],
  });
  assert.deepEqual(summarizeSlackConnections(connections), {
    connected: true,
    activeCount: 1,
    needsAttentionCount: 1,
    disconnectedCount: 0,
    label: "1 workspace connected · 1 needs attention",
  });
});

test("intentional disconnection does not count as a workspace needing attention", () => {
  const connections = resolveSlackDiagnosticConnections({
    links: [{ ...activeLink, disconnected_at: "2026-08-17T02:00:00Z" }],
    installations: [installation],
  });
  const summary = summarizeSlackConnections(connections);
  assert.equal(summary.connected, false);
  assert.equal(summary.needsAttentionCount, 0);
  assert.equal(summary.disconnectedCount, 1);
  assert.equal(summary.label, "Not connected");
});

test("Apps and Settings load the same canonical zero-copy Slack resolver", () => {
  const appsRoute = readFileSync(new URL("../app/api/apps/route.ts", import.meta.url), "utf8");
  const diagnosticsRoute = readFileSync(new URL("../app/api/extension/diagnostics/route.ts", import.meta.url), "utf8");
  const appsPanel = readFileSync(new URL("../components/dashboard/AppsPanel.tsx", import.meta.url), "utf8");
  for (const source of [appsRoute, diagnosticsRoute]) {
    assert.match(source, /loadSlackConnectionsForUser/);
  }
  assert.doesNotMatch(appsRoute, /const slack = providers\.get\("slack"\)/);
  assert.match(appsPanel, /Manage workspaces/);
  assert.match(appsPanel, /Upgrade\/relink/);
  assert.match(appsPanel, /Remove old connection/);
  assert.match(appsPanel, /never uninstalls the workspace app/);
});

test("modern unlink is user-scoped and never revokes the shared workspace installation", () => {
  const server = readFileSync(new URL("../lib/slack-connections-server.ts", import.meta.url), "utf8");
  const genericIntegrationRoute = readFileSync(new URL("../app/api/integrations/[provider]/route.ts", import.meta.url), "utf8");
  assert.match(server, /from\("slack_user_links"\)[\s\S]*disconnected_at: now/);
  assert.match(server, /eq\("beckett_user_id", input\.beckettUserId\)/);
  assert.doesNotMatch(server, /auth\.revoke|slack_installations"\)\s*\.delete/);
  assert.doesNotMatch(genericIntegrationRoute, /"slack"|auth\.revoke/);
});
