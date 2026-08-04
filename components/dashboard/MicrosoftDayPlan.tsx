"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Event = {
  id?: string;
  subject?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: Array<{ emailAddress?: { name?: string; address?: string } }>;
};

function time(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MicrosoftDayPlan() {
  const [events, setEvents] = useState<Event[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    fetch(`/api/microsoft/calendar-events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) { setConnected(false); return; }
        if (!response.ok) throw new Error(data.code === "microsoft_reconnect_required" ? "Microsoft calendar permission needs to be refreshed." : (data.error || "calendar unavailable"));
        setConnected(true);
        setEvents(data.events || []);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Microsoft calendar is unavailable."));
  }, []);

  const suggestion = useMemo(() => {
    if (!events.length) return "Your calendar is open today. Choose one meaningful focus and protect a reset block before the day fills up.";
    const withAttendees = events.filter((event) => (event.attendees || []).length > 0);
    if (events.length >= 4) return "Your day has several commitments. Consider protecting a 20–30 minute reset block between meetings.";
    if (withAttendees.length) return "You have a conversation with other people today. Give yourself a few minutes beforehand to name your outcome.";
    return "Your day has a little structure. Consider choosing one focus and leaving room to recover between tasks.";
  }, [events]);

  if (error) return <section className="mb-6 rounded-card border border-primary/20 bg-primary-light/20 p-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">Plan your day</p><h2 className="mt-1 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Refresh your Outlook connection</h2><p className="mt-2 text-sm leading-relaxed text-ink-mid">{error} Reconnect Microsoft 365 in Settings to let Beckett use the calendars you choose.</p><Link href="/dashboard/settings#connected-accounts" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Reconnect Microsoft 365 →</Link></section>;
  if (connected === false) return <section className="mb-6 rounded-card border border-border bg-white p-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">Plan your day</p><h2 className="mt-1 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Connect your Outlook calendar when you are ready</h2><p className="mt-2 text-sm leading-relaxed text-ink-mid">Beckett can use a read-only view of the calendars you choose to offer suggestions grounded in what is actually scheduled.</p><Link href="/dashboard/settings#connected-accounts" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Connect Microsoft 365 →</Link></section>;

  return <section className="mb-6 rounded-card border border-border bg-white p-6"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-primary">Plan your day</p><h2 className="mt-1 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{events.length ? `${events.length} Outlook event${events.length === 1 ? "" : "s"} today` : "Your calendar is open today"}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mid">{suggestion}</p></div><Link href="/dashboard/calendar" className="shrink-0 self-start rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light">View your week →</Link></div>{events.length > 0 && <div className="mt-5 grid gap-2 sm:grid-cols-2">{events.slice(0, 4).map((event) => <div key={event.id || event.subject} className="rounded-sm border border-border bg-bg/50 px-3 py-3"><p className="text-xs font-medium text-primary">{time(event.start?.dateTime)}{event.end?.dateTime ? `–${time(event.end.dateTime)}` : ""}</p><p className="mt-1 text-sm font-medium text-ink">{event.subject || "Untitled event"}</p>{(event.attendees || []).length > 0 && <p className="mt-1 text-xs text-ink-mid">{event.attendees?.length} attendee{event.attendees?.length === 1 ? "" : "s"}</p>}</div>)}</div>}</section>;
}
