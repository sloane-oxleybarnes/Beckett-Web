import { createHash, randomBytes } from "node:crypto";
import { decryptOAuthToken, encryptOAuthToken } from "@/lib/oauth-token-crypto";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";
import type { CalendarEvent } from "@/lib/calendar-insights";

const MICROSOFT_BASE_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
].join(" ");

export const MICROSOFT_CALENDAR_SCOPES = `${MICROSOFT_BASE_SCOPES} Calendars.ReadBasic`;
export const MICROSOFT_MAIL_SCOPES = `${MICROSOFT_BASE_SCOPES} Mail.Read`;
export const MICROSOFT_CALENDAR_WRITE_SCOPES = `${MICROSOFT_CALENDAR_SCOPES} Calendars.ReadWrite`;
export const MICROSOFT_MAIL_WRITE_SCOPES = `${MICROSOFT_BASE_SCOPES} Mail.ReadWrite`;
export const MICROSOFT_SCOPES = MICROSOFT_CALENDAR_SCOPES;

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type MicrosoftIdTokenClaims = {
  aud?: string;
  tid?: string;
  iss?: string;
  exp?: number;
};

type MicrosoftMetadata = {
  provider?: string;
  email?: string | null;
  display_name?: string | null;
  scopes?: string;
  token_type?: string;
  expires_at?: string;
  refresh_token_encrypted?: string | null;
  token_encrypted?: boolean;
  selectedCalendarIds?: string[];
  [key: string]: unknown;
};

type MicrosoftEvent = {
  id?: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  attendees?: Array<{
    emailAddress?: { name?: string; address?: string };
    status?: { response?: string };
  }>;
  isCancelled?: boolean;
};

type MicrosoftMailMessage = {
  id?: string;
  conversationId?: string;
  conversationIndex?: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  sentDateTime?: string;
  uniqueBody?: { content?: string };
  body?: { content?: string };
};

export type MicrosoftThreadMessage = {
  sender: string;
  subject: string;
  body: string;
  sentAt: string | null;
};

function mergeMicrosoftScopes(...values: Array<string | null | undefined>) {
  return Array.from(new Set(values.flatMap((value) => String(value || "").split(/\s+/).filter(Boolean)))).join(" ") || MICROSOFT_SCOPES;
}

function authority() {
  const tenant = process.env.MICROSOFT_SINGLE_TENANT === "true"
    ? process.env.MICROSOFT_TENANT_ID?.trim() || "common"
    : "common";
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0`;
}

export function microsoftNeedsReconnect(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /access is denied|invalid[_ ](?:client|grant|authentication)|interaction required|consent required|token/i.test(message);
}

export function getMicrosoftClientId() {
  return process.env.MICROSOFT_CLIENT_ID?.trim() || "";
}

export function getMicrosoftClientSecret() {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() || "";
}

export function getMicrosoftRedirectUri(requestOrigin?: string) {
  return process.env.MICROSOFT_REDIRECT_URI?.trim()
    || (requestOrigin ? `${requestOrigin}/api/microsoft/oauth/callback` : "");
}

/**
 * Returns the tenant from the ID token issued during the authorization-code
 * exchange. Existing connections intentionally cannot be backfilled: a
 * reconnect is required before Teams can use the Microsoft integration.
 */
export function extractMicrosoftTenantId(idToken: string | null | undefined) {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as MicrosoftIdTokenClaims;
    const tenantId = typeof claims.tid === "string" ? claims.tid.trim() : "";
    const audience = typeof claims.aud === "string" ? claims.aud.trim() : "";
    const issuer = typeof claims.iss === "string" ? claims.iss.trim() : "";
    const expiresAt = typeof claims.exp === "number" ? claims.exp * 1000 : 0;
    if (!tenantId || audience !== getMicrosoftClientId() || !issuer.includes(`/${tenantId}/`)) return null;
    if (!expiresAt || expiresAt <= Date.now()) return null;
    return tenantId;
  } catch {
    return null;
  }
}

export function isMicrosoftConfigured(requestOrigin?: string) {
  return Boolean(
    getMicrosoftClientId()
    && getMicrosoftClientSecret()
    && getMicrosoftRedirectUri(requestOrigin)
    && process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY?.trim(),
  );
}

export function createMicrosoftCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildMicrosoftAuthorizationUrl(
  state: string,
  redirectUri: string,
  codeChallenge: string,
  scopes = MICROSOFT_SCOPES,
) {
  const url = new URL(`${authority()}/authorize`);
  url.searchParams.set("client_id", getMicrosoftClientId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
  scopes = MICROSOFT_SCOPES,
) {
  const response = await fetch(`${authority()}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getMicrosoftClientId(),
      client_secret: getMicrosoftClientSecret(),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: scopes,
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });
  const token = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;
  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Microsoft token exchange failed");
  }
  return token;
}

async function graphFetch<T>(accessToken: string, path: string) {
  const response = await fetch(`${GRAPH_ROOT}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `Microsoft Graph request failed (${response.status})`);
  return data;
}

export function microsoftHasMailReadScope(scopes: unknown) {
  return typeof scopes === "string" && scopes.split(/\s+/).some((scope) => scope.toLowerCase() === "mail.read");
}

export async function getMicrosoftProfile(accessToken: string) {
  return graphFetch<{ id?: string; displayName?: string; mail?: string; userPrincipalName?: string }>(
    accessToken,
    "/me?$select=id,displayName,mail,userPrincipalName",
  );
}

export async function saveMicrosoftConnection(
  userId: string,
  token: MicrosoftTokenResponse,
  profile: { id?: string; displayName?: string; mail?: string; userPrincipalName?: string },
  tenantId: string | null,
) {
  const { data: existing, error: readError } = await integrationsRepository
    .from("user_integrations")
    .select("metadata")
    .eq("user_id", userId)
    .eq("provider", "microsoft")
    .maybeSingle();
  if (readError) throw readError;

  const previous = existing?.metadata && typeof existing.metadata === "object"
    ? existing.metadata as MicrosoftMetadata
    : {};
  const now = new Date().toISOString();
  const email = profile.mail || profile.userPrincipalName || null;
  const metadata: MicrosoftMetadata = {
    ...previous,
    provider: "microsoft",
    email,
    display_name: profile.displayName || null,
    scopes: mergeMicrosoftScopes(previous.scopes, token.scope),
    token_type: token.token_type || previous.token_type || "Bearer",
    expires_at: new Date(Date.now() + Math.max(token.expires_in || 3600, 60) * 1000).toISOString(),
    refresh_token_encrypted: token.refresh_token
      ? encryptOAuthToken(token.refresh_token)
      : previous.refresh_token_encrypted || null,
    token_encrypted: true,
  };

  const { error } = await integrationsRepository.from("user_integrations").upsert({
    user_id: userId,
    provider: "microsoft",
    access_token: encryptOAuthToken(token.access_token || ""),
    external_user_id: profile.id || email,
    external_tenant_id: tenantId,
    external_team_id: null,
    external_team_name: null,
    metadata,
    connected_at: now,
    updated_at: now,
  }, { onConflict: "user_id,provider" });
  if (error) throw error;
}

export async function getMicrosoftAccessToken(userId: string) {
  const { data: integration, error } = await integrationsRepository
    .from("user_integrations")
    .select("access_token, metadata")
    .eq("user_id", userId)
    .eq("provider", "microsoft")
    .maybeSingle();
  if (error) throw error;
  if (!integration?.access_token) return null;

  const metadata = (integration.metadata || {}) as MicrosoftMetadata;
  const expiresAt = metadata.expires_at ? Date.parse(metadata.expires_at) : 0;
  if (expiresAt > Date.now() + 120_000) return decryptOAuthToken(integration.access_token);
  if (!metadata.refresh_token_encrypted) throw new Error("Microsoft connection needs to be refreshed");

  const response = await fetch(`${authority()}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getMicrosoftClientId(),
      client_secret: getMicrosoftClientSecret(),
      grant_type: "refresh_token",
      refresh_token: decryptOAuthToken(metadata.refresh_token_encrypted),
      scope: metadata.scopes || MICROSOFT_CALENDAR_SCOPES,
    }),
    cache: "no-store",
  });
  const token = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;
  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Microsoft token refresh failed");
  }

  const nextMetadata: MicrosoftMetadata = {
    ...metadata,
    scopes: token.scope || metadata.scopes || MICROSOFT_CALENDAR_SCOPES,
    token_type: token.token_type || metadata.token_type || "Bearer",
    expires_at: new Date(Date.now() + Math.max(token.expires_in || 3600, 60) * 1000).toISOString(),
    refresh_token_encrypted: token.refresh_token
      ? encryptOAuthToken(token.refresh_token)
      : metadata.refresh_token_encrypted,
    token_encrypted: true,
  };
  const { error: updateError } = await integrationsRepository
    .from("user_integrations")
    .update({
      access_token: encryptOAuthToken(token.access_token),
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "microsoft");
  if (updateError) throw updateError;
  return token.access_token;
}

export async function listMicrosoftCalendars(userId: string) {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;
  return graphFetch<{ value?: Array<{ id?: string; name?: string; isDefaultCalendar?: boolean }> }>(
    token,
    "/me/calendars?$select=id,name,isDefaultCalendar",
  );
}

export async function getMicrosoftMessageThread(userId: string, itemId: string) {
  const { data: integration, error } = await integrationsRepository
    .from("user_integrations")
    .select("metadata")
    .eq("user_id", userId)
    .eq("provider", "microsoft")
    .maybeSingle();
  if (error) throw error;
  const metadata = (integration?.metadata || {}) as MicrosoftMetadata;
  if (!integration || !microsoftHasMailReadScope(metadata.scopes)) {
    const scopeError = new Error("Microsoft Mail permission is not connected");
    scopeError.name = "MicrosoftMailPermissionError";
    throw scopeError;
  }

  const accessToken = await getMicrosoftAccessToken(userId);
  if (!accessToken) throw new Error("Microsoft connection needs to be refreshed");
  const current = await graphFetch<MicrosoftMailMessage>(
    accessToken,
    `/me/messages/${encodeURIComponent(itemId)}?$select=id,conversationId`,
  );
  if (!current.conversationId) throw new Error("Outlook could not identify this email conversation");

  const filter = `conversationId eq '${current.conversationId.replace(/'/g, "''")}'`;
  const listParams = new URLSearchParams({
    "$filter": filter,
    "$select": "id,conversationIndex,subject,from,receivedDateTime,sentDateTime",
    "$top": "25",
  });
  const list = await graphFetch<{ value?: MicrosoftMailMessage[] }>(accessToken, `/me/messages?${listParams}`);
  const summaries = (list.value || []).filter((message) => message.id).sort((first, second) => {
    const firstTime = Date.parse(first.sentDateTime || first.receivedDateTime || "") || 0;
    const secondTime = Date.parse(second.sentDateTime || second.receivedDateTime || "") || 0;
    return firstTime - secondTime || String(first.conversationIndex || "").localeCompare(String(second.conversationIndex || ""));
  }).slice(-12);

  const messages = await Promise.all(summaries.map(async (summary): Promise<MicrosoftThreadMessage | null> => {
    const message = await graphFetch<MicrosoftMailMessage>(
      accessToken,
      `/me/messages/${encodeURIComponent(summary.id as string)}?$select=subject,from,receivedDateTime,sentDateTime,uniqueBody,body`,
    );
    const body = (message.uniqueBody?.content || message.body?.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!body) return null;
    const sender = message.from?.emailAddress?.name || message.from?.emailAddress?.address || "Unknown sender";
    return {
      sender,
      subject: message.subject?.trim() || "(no subject)",
      body: body.slice(0, 4_000),
      sentAt: message.sentDateTime || message.receivedDateTime || null,
    };
  }));
  return messages.filter((message): message is MicrosoftThreadMessage => Boolean(message));
}

export async function listMicrosoftCalendarEvents(
  userId: string,
  calendarIds: string[],
  startDateTime: string,
  endDateTime: string,
) {
  const { data: integration, error: metadataError } = await integrationsRepository
    .from("user_integrations")
    .select("metadata")
    .eq("user_id", userId)
    .eq("provider", "microsoft")
    .maybeSingle();
  if (metadataError) throw metadataError;
  const accountEmail = integration?.metadata && typeof integration.metadata === "object" && "email" in integration.metadata
    ? String(integration.metadata.email || "").toLowerCase()
    : "";
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;
  const selected = calendarIds.length ? calendarIds.slice(0, 10) : ["default"];
  const groups = await Promise.all(selected.map(async (calendarId) => {
    const base = calendarId === "default"
      ? "/me/calendarView"
      : `/me/calendars/${encodeURIComponent(calendarId)}/calendarView`;
    const params = new URLSearchParams({
      startDateTime,
      endDateTime,
      "$select": "id,subject,start,end,attendees,isCancelled",
      "$orderby": "start/dateTime",
      "$top": "100",
    });
    const payload = await graphFetch<{ value?: MicrosoftEvent[] }>(token, `${base}?${params}`);
    return (payload.value || []).filter((event) => event.id && event.start?.dateTime && !event.isCancelled).map((event): CalendarEvent => ({
      id: `microsoft:${calendarId}:${event.id as string}`,
      title: event.subject?.trim() || "Untitled meeting",
      start: event.start?.dateTime as string,
      end: event.end?.dateTime || null,
      attendees: (event.attendees || []).filter((attendee) => attendee.emailAddress?.address?.toLowerCase() !== accountEmail).map((attendee) => ({
        name: attendee.emailAddress?.name || null,
        email: attendee.emailAddress?.address || null,
        responseStatus: attendee.status?.response || null,
      })),
    }));
  }));
  return groups.flat().sort((first, second) => new Date(first.start).getTime() - new Date(second.start).getTime());
}

export async function getMicrosoftCalendarEvent(userId: string, eventId: string, calendarId = "default") {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;
  const params = new URLSearchParams({
    "$select": "id,subject,bodyPreview,start,end,location,organizer,attendees,isAllDay,isCancelled,webLink,onlineMeeting",
  });
  const path = calendarId === "default"
    ? `/me/events/${encodeURIComponent(eventId)}`
    : `/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  return graphFetch<Record<string, unknown>>(token, `${path}?${params.toString()}`);
}

export async function listMicrosoftMailMessages(userId: string, search?: string, top = 20) {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;
  const params = new URLSearchParams({
    "$select": "id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,webLink",
    "$top": String(Math.min(Math.max(top, 1), 50)),
    "$orderby": "receivedDateTime DESC",
  });
  if (search?.trim()) params.set("$search", `"${search.trim().replace(/"/g, "")}"`);
  return graphFetch<{ value?: Array<Record<string, unknown>> }>(token, `/me/messages?${params.toString()}`);
}

export async function getMicrosoftMailMessage(userId: string, messageId: string) {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;
  const params = new URLSearchParams({
    "$select": "id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,isRead,webLink",
  });
  return graphFetch<Record<string, unknown>>(token, `/me/messages/${encodeURIComponent(messageId)}?${params.toString()}`);
}

export async function microsoftGraphRequest<T>(userId: string, path: string, init?: RequestInit) {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;
  const response = await fetch(`${GRAPH_ROOT}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `Microsoft Graph request failed (${response.status})`);
  return data;
}

export function newMicrosoftClientState() {
  return randomBytes(32).toString("base64url");
}

export async function createMicrosoftCalendarEvent(userId: string, calendarId: string, input: {
  subject: string;
  start: string;
  end: string;
  timeZone?: string;
}) {
  const path = calendarId === "default" ? "/me/events" : `/me/calendars/${encodeURIComponent(calendarId)}/events`;
  return microsoftGraphRequest<Record<string, unknown>>(userId, path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      subject: input.subject,
      start: { dateTime: input.start, timeZone: input.timeZone || "UTC" },
      end: { dateTime: input.end, timeZone: input.timeZone || "UTC" },
      showAs: "free",
      isReminderOn: false,
    }),
  });
}

export async function createMicrosoftDraft(userId: string, input: {
  subject: string;
  body: string;
  to?: string[];
}) {
  return microsoftGraphRequest<Record<string, unknown>>(userId, "/me/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: "Text", content: input.body.slice(0, 18_000) },
      toRecipients: (input.to || []).slice(0, 20).map((address) => ({ emailAddress: { address } })),
      isDraft: true,
    }),
  });
}

export function microsoftMetadataScopes(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return MICROSOFT_SCOPES;
  const scopes = (metadata as { scopes?: unknown }).scopes;
  return typeof scopes === "string" && scopes.trim() ? scopes : MICROSOFT_SCOPES;
}
