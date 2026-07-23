"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { timeOfDayForDate, type WorkdayCheckin } from "@/lib/workday-patterns";

type Event = {
  id: string;
  title: string;
  start: string;
  attendees: Array<{ name: string | null; email: string | null }>;
};
type Calendar = { connected: boolean; reauthorize?: boolean; events: Event[] };

type Feeling = {
  value: string;
  label: string;
  symbol: string;
  checkin: Pick<WorkdayCheckin, "workload_level" | "energy_level" | "communication_friction" | "break_status" | "helpful_strategy">;
};

const feelings: Feeling[] = [
  { value: "steady", label: "Steady", symbol: "〰", checkin: { workload_level: "steady", energy_level: 3, communication_friction: false, break_status: "not_taken", helpful_strategy: "none_yet" } },
  { value: "low-energy", label: "Low energy", symbol: "▱", checkin: { workload_level: "steady", energy_level: 2, communication_friction: false, break_status: "would_help", helpful_strategy: "short_break" } },
  { value: "stressed", label: "Stressed", symbol: "✳", checkin: { workload_level: "stacked", energy_level: 2, communication_friction: true, break_status: "would_help", helpful_strategy: "clearer_priority" } },
  { value: "focused", label: "Focused", symbol: "◎", checkin: { workload_level: "steady", energy_level: 4, communication_friction: false, break_status: "not_taken", helpful_strategy: "quiet_block" } },
  { value: "overloaded", label: "Overloaded", symbol: "☁", checkin: { workload_level: "stacked", energy_level: 1, communication_friction: true, break_status: "would_help", helpful_strategy: "short_break" } },
];

function eventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function TodayGuide({ name }: { name: string }) {
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [checkinStatus, setCheckinStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch("/api/calendar/events", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as Calendar | null;
    if (response.ok && data) {
      setCalendar(data);
      setUpdatedAt(new Date());
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const today = useMemo(
    () => calendar?.events.filter((event) => new Date(event.start).toDateString() === new Date().toDateString()) || [],
    [calendar]
  );
  const hasLunch = today.some((event) => /lunch|meal|break/i.test(event.title));
  const canSuggestLunch = Boolean(calendar?.connected && !calendar.reauthorize && !hasLunch && today.length);

  async function selectFeeling(feeling: Feeling) {
    setSelectedFeeling(feeling.value);
    setCheckinStatus("saving");
    try {
      const response = await fetch("/api/workday/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...feeling.checkin, time_of_day: timeOfDayForDate() }),
      });
      if (!response.ok) throw new Error();
      setCheckinStatus("saved");
    } catch {
      setCheckinStatus("error");
    }
  }

  return (
    <section className="mb-6 space-y-5">
      <div className="rounded-card border border-border bg-white p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Today with Beckett</p>
        <h2 className="mt-2 text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {name}.
        </h2>
        <p className="mt-1 text-sm text-ink-mid">How are you feeling right now?</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-5">
          {feelings.map((feeling) => (
            <button
              key={feeling.value}
              type="button"
              onClick={() => void selectFeeling(feeling)}
              aria-pressed={selectedFeeling === feeling.value}
              disabled={checkinStatus === "saving"}
              className={`flex min-h-16 items-center gap-3 rounded-sm border px-3 text-left text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${selectedFeeling === feeling.value ? "border-primary bg-primary-light text-ink" : "border-border bg-bg/50 text-ink hover:border-primary/50 hover:bg-primary-light/40"}`}
            >
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-lg text-primary">{feeling.symbol}</span>
              {feeling.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {checkinStatus === "saving" && <span className="text-ink-mid">Saving your check-in…</span>}
          {checkinStatus === "saved" && <span className="text-primary">Check-in saved at {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. You can check in again anytime.</span>}
          {checkinStatus === "error" && <span className="text-red-700">Your check-in did not save. Please try again.</span>}
          <Link href="/dashboard/workday" className="font-medium text-primary hover:underline">View patterns &amp; support plans →</Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Your day</p><h3 className="mt-1 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>What&apos;s ahead</h3></div><button type="button" onClick={() => void load()} className="text-xs font-medium text-primary hover:underline">Refresh</button></div>
          {calendar?.connected && !calendar.reauthorize ? (
            today.length ? <div className="mt-5 space-y-3">{today.slice(0, 4).map((event) => <article key={event.id} className="rounded-sm border border-border bg-bg/60 p-4"><p className="text-xs font-medium text-primary">{eventTime(event.start)}</p><p className="mt-1 text-sm font-medium text-ink">{event.title}</p><Link href={`/dashboard/meeting-prep?title=${encodeURIComponent(event.title)}&attendees=${encodeURIComponent(event.attendees.map((attendee) => attendee.name || attendee.email || "Guest").join(", "))}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Prep for this meeting →</Link></article>)}</div> : <p className="mt-5 rounded-sm border border-border bg-bg/60 p-4 text-sm text-ink-mid">Your calendar is clear today. What would help you make the day feel good?</p>
          ) : <div className="mt-5 rounded-sm border border-primary/20 bg-primary-light/40 p-4 text-sm leading-relaxed text-ink-mid">Connect Google Calendar to see your day here and prepare for upcoming meetings. <Link href="/dashboard/calendar" className="font-medium text-primary hover:underline">Connect calendar →</Link></div>}
          {updatedAt && <p className="mt-4 text-xs text-ink-light">Updated {eventTime(updatedAt.toISOString())}</p>}
        </div>

        <div className="space-y-5">
          {!suggestionDismissed && <div className="rounded-card border border-primary/20 bg-primary-light/40 p-5 sm:p-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">A small suggestion for today</p>{canSuggestLunch ? <><h3 className="mt-2 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>You don&apos;t have a lunch break planned.</h3><p className="mt-2 text-sm leading-relaxed text-ink-mid">Want Beckett to suggest a 30-minute block around 12:30 PM?</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => setSuggestionMessage("A 30-minute lunch block at 12:30 PM would be a good place to start. Beckett has not changed your calendar.")} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark">Suggest a time</button><button type="button" onClick={() => setSuggestionDismissed(true)} className="rounded-pill border border-primary/30 bg-white px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light">Not today</button></div>{suggestionMessage && <p className="mt-4 rounded-sm border border-primary/20 bg-white/80 p-3 text-sm text-ink-mid">{suggestionMessage}</p>}</> : <><h3 className="mt-2 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{calendar?.connected ? "Your schedule leaves some breathing room." : "Start with what would help today."}</h3><p className="mt-2 text-sm leading-relaxed text-ink-mid">Choose one small support for the day. Beckett will never change your calendar without approval.</p></>}</div>}

          <div className="rounded-card border border-border bg-white"><button type="button" onClick={() => setSetupOpen((open) => !open)} aria-expanded={setupOpen} className="flex w-full items-center justify-between p-5 text-left"><span><span className="block text-xs font-medium uppercase tracking-wide text-ink-light">Set up your day</span><span className="mt-1 block text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>A little preparation can lower the pressure.</span></span><span aria-hidden="true" className="text-xl text-primary">{setupOpen ? "−" : "+"}</span></button>{setupOpen && <div className="grid border-t border-border sm:grid-cols-3"><Link href="/dashboard/workday" className="border-b border-border p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">Plan a break</span><span className="mt-1 block text-xs font-normal text-ink-mid">Find a little space to reset.</span></Link><Link href="/dashboard/calendar" className="border-b border-border p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">Prepare for a meeting</span><span className="mt-1 block text-xs font-normal text-ink-mid">Choose a meeting to prepare for.</span></Link><Link href="/dashboard/skills" className="p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40"><span className="block text-primary">Choose a focus</span><span className="mt-1 block text-xs font-normal text-ink-mid">Build a useful skill today.</span></Link></div>}</div>
        </div>
      </div>
    </section>
  );
}
