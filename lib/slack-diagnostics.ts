export type SlackConnectionState = "active" | "degraded" | "disconnected";
export type SlackConnectionKind = "modern" | "legacy";

export type SlackDiagnosticConnection = {
  state: SlackConnectionState;
  kind: SlackConnectionKind;
  connected: boolean;
  teamId: string | null;
  teamName: string | null;
  userId: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
  message: string;
};

export type SlackConnectionSummary = {
  connected: boolean;
  activeCount: number;
  needsAttentionCount: number;
  disconnectedCount: number;
  label: string;
};

type ModernLink = {
  slack_team_id: string;
  slack_user_id: string;
  linked_at: string | null;
  updated_at: string | null;
  disconnected_at: string | null;
};

type Installation = {
  slack_team_id: string;
  encrypted_bot_access_token: string | null;
  encrypted_bot_refresh_token?: string | null;
  bot_token_expires_at?: string | null;
  uninstalled_at: string | null;
  installed_at: string | null;
  updated_at: string | null;
};

type LegacyConnection = {
  external_team_id: string | null;
  external_team_name: string | null;
  external_user_id: string | null;
  connected_at: string | null;
  updated_at: string | null;
};

function installationUsable(installation?: Installation) {
  if (!installation || installation.uninstalled_at) return false;
  if (!installation.encrypted_bot_access_token) return false;
  if (!installation.bot_token_expires_at) return true;
  const expiresAt = new Date(installation.bot_token_expires_at).getTime();
  return expiresAt > Date.now() || Boolean(installation.encrypted_bot_refresh_token);
}

export function resolveSlackDiagnosticConnections(input: {
  links?: ModernLink[] | null;
  installations?: Installation[] | null;
  legacy?: LegacyConnection[] | null;
}) {
  const links = input.links || [];
  const installations = new Map((input.installations || []).map((item) => [item.slack_team_id, item]));
  const legacy = input.legacy || [];
  const teamNames = new Map(
    legacy
      .filter((item) => item.external_team_id && item.external_team_name)
      .map((item) => [item.external_team_id as string, item.external_team_name as string])
  );
  const modernKeys = new Set(links.map((link) => `${link.slack_team_id}:${link.slack_user_id}`));

  const modernConnections: SlackDiagnosticConnection[] = links.map((link) => {
    const installation = installations.get(link.slack_team_id);
    const disconnected = Boolean(link.disconnected_at);
    const usable = !disconnected && installationUsable(installation);
    const state: SlackConnectionState = disconnected ? "disconnected" : usable ? "active" : "degraded";
    const message = disconnected
      ? "Disconnected"
      : usable
        ? "Connected and ready"
        : installation?.uninstalled_at
          ? "Account linked, but the Slack app was uninstalled"
          : "Account linked, but the workspace app needs to be installed or upgraded";
    return {
      state,
      kind: "modern",
      connected: usable,
      teamId: link.slack_team_id,
      teamName: teamNames.get(link.slack_team_id) || null,
      userId: link.slack_user_id,
      connectedAt: link.linked_at,
      updatedAt: link.updated_at,
      message,
    };
  });

  const legacyConnections: SlackDiagnosticConnection[] = legacy
    .filter((item) => !modernKeys.has(`${item.external_team_id}:${item.external_user_id}`))
    .map((item) => ({
      state: "degraded",
      kind: "legacy",
      connected: false,
      teamId: item.external_team_id,
      teamName: item.external_team_name,
      userId: item.external_user_id,
      connectedAt: item.connected_at,
      updatedAt: item.updated_at,
      message: "Legacy connection—upgrade required",
    }));

  return [...modernConnections, ...legacyConnections].sort((a, b) => {
    const rank: Record<SlackConnectionState, number> = { active: 0, degraded: 1, disconnected: 2 };
    return rank[a.state] - rank[b.state] || (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
}

export function summarizeSlackConnections(
  connections: SlackDiagnosticConnection[]
): SlackConnectionSummary {
  const activeCount = connections.filter((connection) => connection.state === "active").length;
  const needsAttentionCount = connections.filter((connection) => connection.state === "degraded").length;
  const disconnectedCount = connections.filter((connection) => connection.state === "disconnected").length;
  const connected = activeCount > 0;

  const workspaceLabel = `${activeCount} workspace${activeCount === 1 ? "" : "s"} connected`;
  const attentionLabel = `${needsAttentionCount} need${needsAttentionCount === 1 ? "s" : ""} attention`;
  const label = connected
    ? needsAttentionCount
      ? `${workspaceLabel} · ${attentionLabel}`
      : workspaceLabel
    : needsAttentionCount
      ? `Not connected · ${attentionLabel}`
      : "Not connected";

  return { connected, activeCount, needsAttentionCount, disconnectedCount, label };
}
