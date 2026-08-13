import { slackRepository } from "@/lib/repositories/slack-repository";
import { decryptSlackToken, encryptSlackToken } from "@/lib/slack-token-crypto";
import { getSlackOAuthWorkerUrl, getSlackRedirectOrigin } from "@/lib/slack-oauth";

export async function saveSlackInstallation(input: {
  teamId: string;
  enterpriseId?: string | null;
  installerUserId?: string | null;
  botAccessToken: string;
  botRefreshToken?: string | null;
  expiresIn?: number | null;
  botScopes: string[];
}) {
  const now = new Date();
  const { error } = await slackRepository.from("slack_installations").upsert({
    slack_team_id: input.teamId,
    slack_enterprise_id: input.enterpriseId || null,
    installer_user_id: input.installerUserId || null,
    encrypted_bot_access_token: encryptSlackToken(input.botAccessToken),
    encrypted_bot_refresh_token: input.botRefreshToken ? encryptSlackToken(input.botRefreshToken) : null,
    bot_token_expires_at: input.expiresIn ? new Date(now.getTime() + input.expiresIn * 1000).toISOString() : null,
    granted_bot_scopes: input.botScopes,
    installed_at: now.toISOString(),
    updated_at: now.toISOString(),
    uninstalled_at: null,
  }, { onConflict: "slack_team_id" });
  if (error) throw error;
}

export async function linkSlackUser(input: { teamId: string; slackUserId: string; beckettUserId: string }) {
  const now = new Date().toISOString();
  const { error } = await slackRepository.from("slack_user_links").upsert({
    slack_team_id: input.teamId,
    slack_user_id: input.slackUserId,
    beckett_user_id: input.beckettUserId,
    linked_at: now,
    updated_at: now,
    disconnected_at: null,
  }, { onConflict: "slack_team_id,slack_user_id" });
  if (error) throw error;
}

export async function getSlackInstallationToken(teamId: string) {
  const { data, error } = await slackRepository.from("slack_installations")
    .select("encrypted_bot_access_token,encrypted_bot_refresh_token,bot_token_expires_at,uninstalled_at")
    .eq("slack_team_id", teamId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.encrypted_bot_access_token || data.uninstalled_at) return null;
  const expiresAt = data.bot_token_expires_at ? new Date(data.bot_token_expires_at).getTime() : null;
  if (!expiresAt || expiresAt > Date.now() + 5 * 60 * 1000) return decryptSlackToken(data.encrypted_bot_access_token);
  if (!data.encrypted_bot_refresh_token) return null;

  const worker = getSlackOAuthWorkerUrl();
  if (!worker) return null;
  const refresh = await fetch(worker, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: decryptSlackToken(data.encrypted_bot_refresh_token),
      redirect_uri: `${getSlackRedirectOrigin()}/api/slack/callback`,
    }),
  }).catch(() => null);
  const token = await refresh?.json().catch(() => ({})) as { ok?: boolean; access_token?: string; refresh_token?: string; expires_in?: number };
  if (!refresh?.ok || !token.ok || !token.access_token) return null;
  const { error: updateError } = await slackRepository.from("slack_installations").update({
    encrypted_bot_access_token: encryptSlackToken(token.access_token),
    encrypted_bot_refresh_token: token.refresh_token ? encryptSlackToken(token.refresh_token) : data.encrypted_bot_refresh_token,
    bot_token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("slack_team_id", teamId);
  if (updateError) throw updateError;
  return token.access_token;
}

export async function markSlackInstallationUninstalled(teamId: string) {
  const now = new Date().toISOString();
  const { error } = await slackRepository.from("slack_installations").update({
    encrypted_bot_access_token: null,
    encrypted_bot_refresh_token: null,
    bot_token_expires_at: null,
    uninstalled_at: now,
    updated_at: now,
  }).eq("slack_team_id", teamId);
  if (error) throw error;
}
