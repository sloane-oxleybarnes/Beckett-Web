"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  attendees: Array<{
    name: string | null;
    email: string | null;
    responseStatus: string | null;
  }>;
};

type CalendarResponse = {
  connected: boolean;
  reauthorize?: boolean;
  events: CalendarEvent[];
};

type CalendarOption = {
  id: string;
  name: string;
  primary: boolean;
};

type CalendarSettingsResponse = {
  connected: boolean;
  reauthorize?: boolean;
  calendars: CalendarOption[];
  selectedCalendarIds: string[];
};

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function attendeeLabel(attendee: CalendarEvent["attendees"][number]) {
  return attendee.name || attendee.email || "Guest";
}

export default function CalendarPanel() {
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [calendarOptions, setCalendarOptions] = useState<CalendarOption[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [loadingCalendarSettings, setLoadingCalendarSettings] = useState(false);
  const [savingCalendarSettings, setSavingCalendarSettings] = useState(false);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/calendar/events", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as CalendarResponse & { error?: string } | null;
      if (!response.ok || !data) throw new Error(data?.error || "Could not load your calendar.");
      setCalendar(data);
      if (data.connected && !data.reauthorize) {
        setLoadingCalendarSettings(true);
        const settingsResponse = await fetch("/api/calendar/calendars", { cache: "no-store" });
        const settings = (await settingsResponse.json().catch(() => null)) as CalendarSettingsResponse & { error?: string } | null;
        if (!settingsResponse.ok) throw new Error(settings?.error || "Could not load your calendar settings.");
        if (!settings?.reauthorize) {
          setCalendarOptions(settings?.calendars || []);
          setSelectedCalendarIds(settings?.selectedCalendarIds || []);
        }
      } else {
        setCalendarOptions([]);
        setSelectedCalendarIds([]);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load your calendar.");
    } finally {
      setLoading(false);
      setLoadingCalendarSettings(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("calendar");
    if (!status) return;
    if (status === "connected") setError(null);
    else if (status === "cancelled") setError("Calendar connection was cancelled.");
    else if (status === "configuration-required") setError("Calendar connection is still being configured. Please try again shortly.");
    else setError("Calendar connection could not be completed. Please try again.");
    window.history.replaceState({}, "", "/dashboard/calendar");
  }, []);

  async function connectCalendar() {
    setError(null);
    window.location.assign("/api/calendar/oauth/start");
  }

  async function disconnectCalendar() {
    const confirmed = window.confirm(
      "Disconnect Google Calendar? Beckett will stop reading upcoming events. Existing coaching history and contacts will not be deleted."
    );
    if (!confirmed) return;

    setDisconnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/google_calendar", { method: "DELETE" });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Could not disconnect Google Calendar.");
      await loadCalendar();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not disconnect Google Calendar.");
    } finally {
      setDisconnecting(false);
    }
  }

  function toggleCalendar(calendarId: string) {
    setSelectedCalendarIds((current) => current.includes(calendarId)
      ? current.filter((id) => id !== calendarId)
      : [...current, calendarId]);
  }

  async function saveCalendarSettings() {
    if (!selectedCalendarIds.length) {
      setError("Choose at least one calendar.");
      return;
    }
    setSavingCalendarSettings(true);
    setError(null);
    try {
      const response = await fetch("/api/calendar/calendars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCalendarIds }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Could not save your calendar choices.");
      await loadCalendar();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save your calendar choices.");
    } finally {
      setSavingCalendarSettings(false);
    }
  }

  const needsConnection = !calendar?.connected || calendar.reauthorize;

  return (
    <div className="max-w-3xl">
      <h1
        className="text-3xl text-ink mb-2"
        style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
      >
        Calendar
      </h1>
      <p className="text-ink-mid text-sm mb-8">
        See what is coming up and prepare before you walk in.
      </p>
      <div className="mb-5 flex flex-wrap gap-4 text-sm font-medium text-primary">
        <Link href="/dashboard/meetings" className="hover:underline">Meeting notes & support →</Link>
      </div>

      <div className="mb-5 rounded-sm border border-primary/15 bg-primary-light/40 p-4 text-sm leading-relaxed text-ink-mid">
        Beckett reads upcoming event titles, timing, and attendees to give you basic meeting context.
        It cannot create, edit, cancel, or respond to calendar events, and it does not store your events.
      </div>

      {calendar?.connected && !calendar.reauthorize && (
        <div className="mb-5 rounded-card border border-border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-ink">Calendar settings</h2>
              <p className="mt-1 text-sm text-ink-mid">Choose the calendars Beckett should include in your upcoming-meeting view.</p>
            </div>
            <button
              type="button"
              onClick={() => void disconnectCalendar()}
              disabled={disconnecting}
              className="text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect Google Calendar"}
            </button>
          </div>
          {loadingCalendarSettings ? (
            <p className="mt-4 text-sm text-ink-mid">Loading your calendars…</p>
          ) : calendarOptions.length ? (
            <>
              <div className="mt-4 space-y-2">
                {calendarOptions.map((calendarOption) => (
                  <label key={calendarOption.id} className="flex cursor-pointer items-center gap-3 rounded-sm border border-border px-3 py-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={selectedCalendarIds.includes(calendarOption.id)}
                      onChange={() => toggleCalendar(calendarOption.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{calendarOption.name}{calendarOption.primary ? " (primary)" : ""}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void saveCalendarSettings()}
                disabled={savingCalendarSettings || !selectedCalendarIds.length}
                className="mt-4 rounded-pill bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingCalendarSettings ? "Saving…" : "Save calendar choices"}
              </button>
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-mid">Your Google calendars could not be listed yet. Reconnect once after enabling Calendar access.</p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-card border border-border bg-white p-8 text-sm text-ink-mid">
          Loading your calendar…
        </div>
      ) : needsConnection ? (
        <div className="rounded-card border border-border bg-white p-8 text-center">
          <p className="mb-3 text-3xl">📅</p>
          <h2 className="mb-2 text-lg font-medium text-ink">
            {calendar?.reauthorize ? "Reconnect Google Calendar" : "Connect Google Calendar"}
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-ink-mid">
            Give Beckett read-only access to your upcoming events so you can see meeting titles,
            timing, and attendees in one place. Beckett does not store your events or make calendar changes.
          </p>
          <p className="mx-auto mb-5 max-w-md text-xs leading-relaxed text-ink-light">
            By continuing, you authorize this read-only access for the feature above. You can disconnect at any time.
            Read our <Link href="/privacy" className="font-medium text-primary hover:underline">Privacy and Trust policy</Link>.
          </p>
          <button
            type="button"
            onClick={() => void connectCalendar()}
            className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            {calendar?.reauthorize ? "Reconnect Google Calendar" : "Connect Google Calendar"}
          </button>
        </div>
      ) : calendar.events.length === 0 ? (
        <div className="rounded-card border border-border bg-white p-8 text-center">
          <p className="mb-2 text-lg font-medium text-ink">No upcoming meetings this week</p>
          <p className="text-sm text-ink-mid">When a timed calendar event is coming up, it will appear here.</p>
        </div>
      ) : (
        <section className="rounded-card border border-border bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>
              Upcoming meetings
            </h2>
            <button
              type="button"
              onClick={() => void loadCalendar()}
              className="text-xs font-medium text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-3">
            {calendar.events.map((event) => (
              <article key={event.id} className="rounded-sm border border-border bg-bg/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{formatEventTime(event.start)}</p>
                <h3 className="mt-1 text-base font-medium text-ink">{event.title}</h3>
                <p className="mt-2 text-xs text-ink-light">
                  {event.attendees.length
                    ? `${event.attendees.slice(0, 4).map(attendeeLabel).join(", ")}${event.attendees.length > 4 ? ` +${event.attendees.length - 4}` : ""}`
                    : "No other attendees listed"}
                </p>
                <Link href={`/dashboard/meeting-prep?title=${encodeURIComponent(event.title)}&attendees=${encodeURIComponent(event.attendees.map(attendeeLabel).join(", "))}`} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Prep for this meeting →</Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
