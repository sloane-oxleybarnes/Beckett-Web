import { NextResponse } from "next/server";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { decryptGoogleAccessToken, encryptGoogleAccessToken } from "@/lib/google-token-security";
import {
  getGoogleCalendarOAuthConfig,
  parseGoogleCalendarCredential,
  refreshGoogleCalendarCredential,
} from "@/lib/google-calendar-oauth";
import { listMicrosoftCalendarEvents, microsoftNeedsReconnect } from "@/lib/microsoft-oauth";
import type { CalendarEvent } from "@/lib/calendar-insights";

type Integration = {
  id: string;
  provider: string;
  access_token: string | null;
  metadata: unknown;
};

type ProviderResult = {
  connected: boolean;
  reauthorize?: boolean;
  events: CalendarEvent[];
  error?: string;
};

function selectedCalendarIds(metadata: unknown, fallback: string[]) {
  const ids = typeof metadata === "object" && metadata && Array.isArray((metadata as { selectedCalendarIds?: unknown }).selectedCalendarIds)
    ? (metadata as { selectedCalendarIds: unknown[] }).selectedCalendarIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  return ids.length ? ids.slice(0, 10) : fallback;
}

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: Array<{ self?: boolean; displayName?: string; email?: string; responseStatus?: string }>;
};

async function loadGoogleCalendar(
  integration: Integration | undefined,
  origin: string,
  timeMin: Date,
  timeMax: Date,
): Promise<ProviderResult> {
  if (!integration) return { connected: false, events: [] };
  const serializedCredential = decryptGoogleAccessToken(integration.access_token);
  let credential = parseGoogleCalendarCredential(serializedCredential);
  const oauthConfig = getGoogleCalendarOAuthConfig(origin);
  if (!credential || !oauthConfig) return { connected: true, reauthorize: true, events: [] };

  if (credential.expiresAt <= Date.now() + 60_000) {
    const refreshed = await refreshGoogleCalendarCredential(credential, oauthConfig.clientId, oauthConfig.clientSecret);
    if (!refreshed) return { connected: true, reauthorize: true, events: [] };
    credential = refreshed;
    const { error } = await integrationsRepository.from("user_integrations").update({
      access_token: encryptGoogleAccessToken(JSON.stringify(credential)),
      updated_at: new Date().toISOString(),
    }).eq("id", integration.id);
    if (error) return { connected: true, events: [], error: "Google Calendar token could not be refreshed." };
  }

  try {
    const responses = await Promise.all(selectedCalendarIds(integration.metadata, ["primary"]).map(async (calendarId) => {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
        fields: "items(id,summary,start(dateTime),end(dateTime),attendees(self,displayName,email,responseStatus))",
      });
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${credential.accessToken}` }, cache: "no-store" },
      );
      return { calendarId, response };
    }));
    if (responses.some(({ response }) => response.status === 401 || response.status === 403)) {
      return { connected: true, reauthorize: true, events: [] };
    }
    if (responses.some(({ response }) => !response.ok)) {
      return { connected: true, events: [], error: "Google Calendar could not load your events." };
    }
    const groups = await Promise.all(responses.map(async ({ calendarId, response }) => ({
      calendarId,
      items: ((await response.json()) as { items?: GoogleCalendarEvent[] }).items || [],
    })));
    return {
      connected: true,
      events: groups.flatMap(({ calendarId, items }) => items.filter((event) => event.id && event.start?.dateTime).map((event): CalendarEvent => ({
        id: `google:${calendarId}:${event.id as string}`,
        title: event.summary?.trim() || "Untitled meeting",
        start: event.start?.dateTime as string,
        end: event.end?.dateTime || null,
        attendees: (event.attendees || []).filter((attendee) => !attendee.self).map((attendee) => ({
          name: attendee.displayName || null,
          email: attendee.email || null,
          responseStatus: attendee.responseStatus || null,
        })),
      }))),
    };
  } catch {
    return { connected: true, events: [], error: "Google Calendar could not be reached." };
  }
}

async function loadMicrosoftCalendar(
  userId: string,
  integration: Integration | undefined,
  timeMin: Date,
  timeMax: Date,
): Promise<ProviderResult> {
  if (!integration) return { connected: false, events: [] };
  try {
    const events = await listMicrosoftCalendarEvents(
      userId,
      selectedCalendarIds(integration.metadata, []),
      timeMin.toISOString(),
      timeMax.toISOString(),
    );
    return { connected: true, events: events || [] };
  } catch (error) {
    if (microsoftNeedsReconnect(error)) return { connected: true, reauthorize: true, events: [] };
    return { connected: true, events: [], error: "Microsoft Calendar could not be reached." };
  }
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data: integrations, error: integrationError } = await integrationsRepository
    .from("user_integrations")
    .select("id, provider, access_token, metadata")
    .eq("user_id", user.id)
    .in("provider", ["google_calendar", "microsoft"]);
  if (integrationError) return NextResponse.json({ error: "Could not read calendar connections." }, { status: 500 });

  const url = new URL(request.url);
  const defaultStart = new Date();
  const defaultEnd = new Date(defaultStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const parsedStart = url.searchParams.get("from") ? new Date(url.searchParams.get("from") as string) : defaultStart;
  const parsedEnd = url.searchParams.get("to") ? new Date(url.searchParams.get("to") as string) : defaultEnd;
  const validRange = !Number.isNaN(parsedStart.getTime())
    && !Number.isNaN(parsedEnd.getTime())
    && parsedEnd > parsedStart
    && parsedEnd.getTime() - parsedStart.getTime() <= 14 * 24 * 60 * 60 * 1000;
  if (!validRange) return NextResponse.json({ error: "Choose a valid date range of 14 days or less." }, { status: 400 });

  const google = (integrations || []).find((item) => item.provider === "google_calendar") as Integration | undefined;
  const microsoft = (integrations || []).find((item) => item.provider === "microsoft") as Integration | undefined;
  const [googleResult, microsoftResult] = await Promise.all([
    loadGoogleCalendar(google, url.origin, parsedStart, parsedEnd),
    loadMicrosoftCalendar(user.id, microsoft, parsedStart, parsedEnd),
  ]);
  const configured = [googleResult, microsoftResult].filter((result) => result.connected);
  const events = [...googleResult.events, ...microsoftResult.events]
    .sort((first, second) => new Date(first.start).getTime() - new Date(second.start).getTime());
  const warnings = [googleResult.error, microsoftResult.error].filter((value): value is string => Boolean(value));

  if (configured.length > 0 && configured.every((result) => result.error) && events.length === 0) {
    return NextResponse.json({ error: warnings.join(" ") || "Calendar providers could not be reached." }, { status: 502 });
  }
  return NextResponse.json({
    connected: configured.length > 0,
    reauthorize: configured.length > 0 && configured.every((result) => result.reauthorize),
    events,
    warnings,
    connections: {
      google: { connected: googleResult.connected, reauthorize: Boolean(googleResult.reauthorize) },
      microsoft: { connected: microsoftResult.connected, reauthorize: Boolean(microsoftResult.reauthorize) },
    },
  });
}
