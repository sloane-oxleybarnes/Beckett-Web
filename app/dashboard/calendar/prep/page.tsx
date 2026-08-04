"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Event = {
  id?: string;
  subject?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  location?: { displayName?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
  attendees?: Array<{ emailAddress?: { name?: string; address?: string }; type?: string }>;
  onlineMeeting?: { joinUrl?: string };
};

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function MeetingPrepPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event") || "";
  const calendarId = searchParams.get("calendarId") || "default";
  const fallbackSubject = searchParams.get("subject") || "Meeting";
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [hardPart, setHardPart] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/microsoft/calendar-events/${encodeURIComponent(eventId)}?calendarId=${encodeURIComponent(calendarId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load this meeting");
        setEvent(data.event || null);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load this meeting"))
      .finally(() => setLoading(false));
  }, [calendarId, eventId]);

  const subject = event?.subject || fallbackSubject;
  const attendees = useMemo(() => event?.attendees || [], [event?.attendees]);
  const suggestions = useMemo(() => [
    `Write down the one outcome you want from “${subject}.”`,
    attendees.length ? `Choose one question for ${attendees[0]?.emailAddress?.name || "the other attendee"}.` : "Write one sentence that describes what you need from this conversation.",
    hardPart ? `Plan a first sentence that makes the hard part explicit: “${hardPart}.”` : "Choose a simple opening sentence so you do not have to improvise under pressure.",
  ], [attendees, hardPart, subject]);

  return (
    <div className="w-full max-w-3xl">
      <Link href="/dashboard/calendar" className="text-sm text-primary hover:underline">← Back to Calendar &amp; Meetings</Link>
      <div className="mt-5 mb-7">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Meeting preparation</p>
        <h1 className="mt-2 text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{subject}</h1>
        <p className="mt-2 text-sm text-ink-mid">Beckett will help you decide what would make this conversation feel more manageable. Nothing is sent or added to the calendar.</p>
      </div>

      {error && <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
      {loading && <div className="rounded-card border border-border bg-white p-6 text-sm text-ink-mid">Loading meeting context…</div>}
      {!loading && !error && (
        <>
          <section className="rounded-card border border-border bg-white p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs uppercase tracking-wide text-ink-light">When</p><p className="mt-1 text-sm text-ink">{formatTime(event?.start?.dateTime)}{event?.end?.dateTime ? ` – ${formatTime(event.end.dateTime)}` : ""}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-ink-light">Who is there</p><p className="mt-1 text-sm text-ink">{attendees.length ? attendees.map((attendee) => attendee.emailAddress?.name || attendee.emailAddress?.address).filter(Boolean).join(", ") : "No other attendees"}</p></div>
              {event?.location?.displayName && <div><p className="text-xs uppercase tracking-wide text-ink-light">Where</p><p className="mt-1 text-sm text-ink">{event.location.displayName}</p></div>}
              {event?.organizer?.emailAddress && <div><p className="text-xs uppercase tracking-wide text-ink-light">Organizer</p><p className="mt-1 text-sm text-ink">{event.organizer.emailAddress.name || event.organizer.emailAddress.address}</p></div>}
            </div>
          </section>

          <section className="mt-5 rounded-card border border-primary/20 bg-primary-light/30 p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Let’s make a small plan</p>
            <h2 className="mt-2 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>What would help you leave this meeting feeling prepared?</h2>
            <label className="mt-5 block text-sm font-medium text-ink">What is the outcome you want?</label>
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} placeholder="For example: leave with a clear decision, ask for feedback, or set a boundary." className="mt-2 w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
            <label className="mt-4 block text-sm font-medium text-ink">What might feel difficult?</label>
            <textarea value={hardPart} onChange={(event) => setHardPart(event.target.value)} rows={3} placeholder="For example: unclear expectations, asking for more time, or bringing up a sensitive topic." className="mt-2 w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
            <button type="button" onClick={() => setReady(true)} className="mt-4 rounded-pill bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">Build my prep plan</button>
          </section>

          {ready && <section className="mt-5 rounded-card border border-border bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Your prep plan</p>
            {goal && <p className="mt-3 rounded-sm border border-border bg-bg/60 px-3 py-3 text-sm text-ink"><span className="font-medium">Your outcome:</span> {goal}</p>}
            <ul className="mt-4 space-y-3">{suggestions.map((suggestion) => <li key={suggestion} className="flex gap-3 text-sm leading-relaxed text-ink"><span className="mt-0.5 text-primary">✓</span><span>{suggestion}</span></li>)}</ul>
            <div className="mt-5 flex flex-wrap gap-3"><Link href="/dashboard/practice" className="rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light">Practice the conversation</Link><button type="button" onClick={() => setReady(false)} className="rounded-pill border border-border px-4 py-2 text-sm text-ink hover:bg-bg">Adjust answers</button></div>
          </section>}
        </>
      )}
    </div>
  );
}
