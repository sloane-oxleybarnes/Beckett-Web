import "server-only";

import { integrationsRepository } from "@/lib/repositories/integrations-repository";
import {
  resolveSlackDiagnosticConnections,
  summarizeSlackConnections,
  type SlackDiagnosticConnection,
} from "@/lib/slack-diagnostics";

export async function loadSlackConnectionsForUser(userId: string) {
  const [{ data: links, error: linksError }, { data: legacy, error: legacyError }] = await Promise.all([
    integrationsRepository
      .from("slack_user_links")
      .select("slack_team_id, slack_user_id, linked_at, updated_at, disconnected_at")
      .eq("beckett_user_id", userId),
    integrationsRepository
      .from("user_integrations")
      .select("external_team_id, external_team_name, external_user_id, connected_at, updated_at")
      .eq("user_id", userId)
      .eq("provider", "slack"),
  ]);

  if (linksError || legacyError) throw linksError || legacyError;

  const teamIds = Array.from(new Set((links || []).map((link) => link.slack_team_id)));
  const { data: installations, error: installationsError } = teamIds.length
    ? await integrationsRepository
        .from("slack_installations")
        .select("slack_team_id, encrypted_bot_access_token, encrypted_bot_refresh_token, bot_token_expires_at, uninstalled_at, installed_at, updated_at")
        .in("slack_team_id", teamIds)
    : { data: [], error: null };

  if (installationsError) throw installationsError;

  const connections = resolveSlackDiagnosticConnections({
    links: links || [],
    installations: installations || [],
    legacy: legacy || [],
  });

  return {
    connections,
    summary: summarizeSlackConnections(connections),
  };
}

export async function unlinkModernSlackConnection(input: {
  beckettUserId: string;
  teamId: string;
  slackUserId: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await integrationsRepository
    .from("slack_user_links")
    .update({
      disconnected_at: now,
      updated_at: now,
      encrypted_user_access_token: null,
      encrypted_user_refresh_token: null,
      user_token_expires_at: null,
      granted_user_scopes: [],
    })
    .eq("beckett_user_id", input.beckettUserId)
    .eq("slack_team_id", input.teamId)
    .eq("slack_user_id", input.slackUserId)
    .is("disconnected_at", null)
    .select("slack_team_id, slack_user_id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function removeLegacySlackConnection(input: {
  beckettUserId: string;
  teamId: string;
  slackUserId: string;
}) {
  const { data, error } = await integrationsRepository
    .from("user_integrations")
    .delete()
    .eq("user_id", input.beckettUserId)
    .eq("provider", "slack")
    .eq("external_team_id", input.teamId)
    .eq("external_user_id", input.slackUserId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export type { SlackDiagnosticConnection };
