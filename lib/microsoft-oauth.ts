import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";
import { decryptOAuthToken, encryptOAuthToken } from "@/lib/oauth-token-crypto";
import { supabaseAdmin } from "@/lib/server-admin";

export const MICROSOFT_CALENDAR_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.ReadBasic",
].join(" ");

// Mail is requested incrementally. This keeps the initial calendar consent narrow
// while allowing Outlook Decode to ask for body access only when the user enables it.
export const MICROSOFT_MAIL_SCOPES = `${MICROSOFT_CALENDAR_SCOPES} Mail.Read`;
export const MICROSOFT_CALENDAR_WRITE_SCOPES = `${MICROSOFT_CALENDAR_SCOPES} Calendars.ReadWrite`;
// Mail.ReadWrite already includes read access; do not request both overlapping
// mail scopes in the same authorization request.
export const MICROSOFT_MAIL_WRITE_SCOPES = `${MICROSOFT_CALENDAR_SCOPES} Mail.ReadWrite`;
export const MICROSOFT_SCOPES = MICROSOFT_CALENDAR_SCOPES;

export function microsoftNeedsReconnect(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /access is denied|invalid[_ ](?:client|grant|authentication)|interaction required|consent required|token/i.test(message);
}

const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
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
};

export function getMicrosoftClientId() {
  return process.env.MICROSOFT_CLIENT_ID?.trim() || "";
}

export function getMicrosoftClientSecret() {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() || "";
}

export function getMicrosoftRedirectUri(requestOrigin?: string) {
  return (
    process.env.MICROSOFT_REDIRECT_URI?.trim() ||
    (requestOrigin ? `${requestOrigin}/api/microsoft/oauth/callback` : "")
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
  const url = new URL(`${AUTHORITY}/authorize`);
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
  const body = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    client_secret: getMicrosoftClientSecret(),
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: scopes,
    code_verifier: codeVerifier,
  });
  const response = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Microsoft token exchange failed");
  }
  return data;
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

export async function getMicrosoftProfile(accessToken: string) {
  return graphFetch<{ id?: string; displayName?: string; mail?: string; userPrincipalName?: string }>(
    accessToken,
    "/me?$select=id,displayName,mail,userPrincipalName",
  );
}

export async function saveMicrosoftConnection(userId: string, token: MicrosoftTokenResponse, profile: {
  id?: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + Math.max(token.expires_in || 3600, 60) * 1000).toISOString();
  const email = profile.mail || profile.userPrincipalName || null;
  const metadata: MicrosoftMetadata = {
    provider: "microsoft",
    email,
    display_name: profile.displayName || null,
    scopes: token.scope || MICROSOFT_SCOPES,
    token_type: token.token_type || "Bearer",
    expires_at: expiresAt,
    refresh_token_encrypted: token.refresh_token ? encryptOAuthToken(token.refresh_token) : null,
    token_encrypted: true,
  };

  const { error } = await supabaseAdmin.from("user_integrations").upsert(
    {
      user_id: userId,
      provider: "microsoft",
      access_token: encryptOAuthToken(token.access_token || ""),
      external_user_id: profile.id || email,
      external_team_id: null,
      external_team_name: null,
      metadata,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw error;
  return { email, displayName: profile.displayName || null, expiresAt };
}

export async function getMicrosoftAccessToken(userId: string) {
  const { data: integration, error } = await supabaseAdmin
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

  if (!metadata.refresh_token_encrypted) return decryptOAuthToken(integration.access_token);
  const refreshToken = decryptOAuthToken(metadata.refresh_token_encrypted);
  const body = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    client_secret: getMicrosoftClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: metadata.scopes || MICROSOFT_SCOPES,
  });
  const response = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const token = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;
  if (!response.ok || !token.access_token) throw new Error(token.error_description || "Microsoft token refresh failed");

  const nextExpiresAt = new Date(Date.now() + Math.max(token.expires_in || 3600, 60) * 1000).toISOString();
  const nextMetadata: MicrosoftMetadata = {
    ...metadata,
    scopes: token.scope || metadata.scopes || MICROSOFT_SCOPES,
    token_type: token.token_type || metadata.token_type || "Bearer",
    expires_at: nextExpiresAt,
    refresh_token_encrypted: token.refresh_token ? encryptOAuthToken(token.refresh_token) : metadata.refresh_token_encrypted,
    token_encrypted: true,
  };
  await supabaseAdmin
    .from("user_integrations")
    .update({ access_token: encryptOAuthToken(token.access_token), metadata: nextMetadata, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", "microsoft");
  return token.access_token;
}

export async function listMicrosoftCalendars(userId: string) {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;
  return graphFetch<{ value?: Array<Record<string, unknown>> }>(
    token,
    "/me/calendars?$select=id,name,color,hexColor,canEdit,owner",
  );
}

type MicrosoftEvent = {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
  attendees?: Array<{ emailAddress?: { name?: string; address?: string }; type?: string; status?: { response?: string } }>;
  isAllDay?: boolean;
  isCancelled?: boolean;
  webLink?: string;
  onlineMeeting?: { joinUrl?: string };
  calendarId?: string;
  calendarName?: string;
};

export async function listMicrosoftCalendarEvents(
  userId: string,
  calendarIds: string[],
  startDateTime: string,
  endDateTime: string,
) {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;
  const selected = calendarIds.length ? calendarIds : ["default"];
  const results: MicrosoftEvent[] = [];

  for (const calendarId of selected) {
    const encodedCalendarId = encodeURIComponent(calendarId);
    const path = calendarId === "default" ? "/me/calendarView" : `/me/calendars/${encodedCalendarId}/calendarView`;
    const params = new URLSearchParams({
      startDateTime,
      endDateTime,
      "$select": "id,subject,bodyPreview,start,end,location,organizer,attendees,isAllDay,isCancelled,webLink,onlineMeeting",
      "$orderby": "start/dateTime",
      "$top": "100",
    });
    const data = await graphFetch<{ value?: MicrosoftEvent[] }>(token, `${path}?${params.toString()}`);
    results.push(...(data.value || []).map((event) => ({ ...event, calendarId })));
  }

  return results;
}

export async function getMicrosoftCalendarEvent(userId: string, eventId: string, calendarId = "default") {
  const token = await getMicrosoftAccessToken(userId);
  if (!token) return null;
  const params = new URLSearchParams({
    "$select": "id,subject,bodyPreview,start,end,location,organizer,attendees,isAllDay,isCancelled,webLink,onlineMeeting",
  });
  const path = calendarId === "default" ? `/me/events/${encodeURIComponent(eventId)}` : `/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  return graphFetch<MicrosoftEvent>(token, `${path}?${params.toString()}`);
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
