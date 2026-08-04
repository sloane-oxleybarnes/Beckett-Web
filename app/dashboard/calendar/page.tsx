"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Calendar = { id?: string; name?: string; color?: string; hexColor?: string };
type Event = {
  id?: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  attendees?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  isAllDay?: boolean;
  isCancelled?: boolean;
  webLink?: string;
  onlineMeeting?: { joinUrl?: string };
  calendarId?: string;
};

function mondayFor(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function formatDay(value: Date) {
  return value.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function attendeesFor(event: Event) {
  return (event.attendees || []).filter((attendee) => attendee.emailAddress?.address || attendee.emailAddress?.name);
}

function localDateTimeValue(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function eventRange(event: Event) {
  if (!event.start?.dateTime || !event.end?.dateTime) return null;
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return { start, end };
}

function findOpenWindow(dayEvents: Event[], minutes: number, fromHour: number, toHour: number) {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const windowStart = new Date(day);
  windowStart.setHours(fromHour, 0, 0, 0);
  const windowEnd = new Date(day);
  windowEnd.setHours(toHour, 0, 0, 0);
  const ranges = dayEvents.map(eventRange).filter((range): range is { start: Date; end: Date } => Boolean(range)).sort((a, b) => a.start.getTime() - b.start.getTime());
  let cursor = windowStart;
  const now = new Date();
  if (now.toDateString() === day.toDateString() && now > cursor) {
    cursor = new Date(now);
    cursor.setSeconds(0, 0);
    const roundedMinutes = Math.ceil(cursor.getMinutes() / 5) * 5;
    if (roundedMinutes === 60) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
    } else {
      cursor.setMinutes(roundedMinutes);
    }
  }
  if (cursor >= windowEnd) return null;
  for (const range of ranges) {
    if (range.end <= windowStart || range.start >= windowEnd) continue;
    const start = range.start < windowStart ? windowStart : range.start;
    if (start.getTime() - cursor.getTime() >= minutes * 60 * 1000) {
      const end = new Date(cursor);
      end.setMinutes(end.getMinutes() + minutes);
      return { start: new Date(cursor), end };
    }
    if (range.end > cursor) cursor = range.end;
  }
  if (windowEnd.getTime() - cursor.getTime() >= minutes * 60 * 1000) {
    const end = new Date(cursor);
    end.setMinutes(end.getMinutes() + minutes);
    return { start: new Date(cursor), end };
  }
  return null;
}

type CalendarSuggestion = {
  title: string;
  description: string;
  actionLabel?: string;
  actionKind?: "block" | "review" | "settings";
  start?: string;
  end?: string;
  blockType?: string;
  href?: string;
  secondary?: Array<{ label: string; blockType: string }>;
};

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => mondayFor(new Date()));
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [savingCalendars, setSavingCalendars] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockType, setBlockType] = useState("Lunch");
  const [customBlockName, setCustomBlockName] = useState("");
  const [blockStatus, setBlockStatus] = useState("");
  const [calendarWriteEnabled, setCalendarWriteEnabled] = useState(false);
  const [scheduleReviewVisible, setScheduleReviewVisible] = useState(false);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return day;
  }), [weekStart]);

  async function loadCalendars() {
    const response = await fetch("/api/microsoft/calendars", { cache: "no-store" });
    if (response.status === 404) {
      setConnected(false);
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.code === "microsoft_reconnect_required" ? "Microsoft calendar permission needs to be refreshed. Reconnect Microsoft 365 in Settings, then return here." : (data.error || "Could not load Microsoft calendars"));
    setConnected(true);
    setCalendars(data.calendars || []);
    setSelectedCalendarIds(data.selectedCalendarIds || []);
  }

  async function loadEvents() {
    const start = new Date(weekStart);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
    const response = await fetch(`/api/microsoft/calendar-events?${params.toString()}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) {
      setConnected(false);
      return;
    }
    if (!response.ok) throw new Error(data.code === "microsoft_reconnect_required" ? "Microsoft calendar permission needs to be refreshed. Reconnect Microsoft 365 in Settings, then return here." : (data.error || "Could not load Microsoft events"));
    setConnected(true);
    setEvents(data.events || []);
  }

  async function loadCalendarPermissions() {
    try {
      const response = await fetch("/api/extension/diagnostics", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const scopes = typeof data?.integrations?.microsoft?.scopes === "string" ? data.integrations.microsoft.scopes.split(" ") : [];
      setCalendarWriteEnabled(scopes.includes("Calendars.ReadWrite"));
    } catch {
      setCalendarWriteEnabled(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadCalendars(), loadEvents(), loadCalendarPermissions()])
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load your Outlook calendar"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function saveCalendarSelection() {
    setSavingCalendars(true);
    setError(null);
    try {
      const response = await fetch("/api/microsoft/calendars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ calendarIds: selectedCalendarIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save calendar selection");
      setSelectedCalendarIds(data.selectedCalendarIds || selectedCalendarIds);
      setShowCalendarSettings(false);
      await loadEvents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save calendar selection");
    } finally {
      setSavingCalendars(false);
    }
  }

  function openBlockForm(start: string, end: string, type: string) {
    setBlockStart(start);
    setBlockEnd(end);
    setBlockType(type);
    setCustomBlockName("");
    setBlockStatus("");
    setShowBlockForm(true);
  }

  async function createProtectedBreak() {
    const subject = blockType === "Custom" ? customBlockName.trim() : blockType;
    if (!subject) {
      setBlockStatus("Enter a name for this calendar block.");
      return;
    }
    if (!blockStart || !blockEnd || !window.confirm(`Add “${subject}” to Outlook? Beckett will only create it after you confirm.`)) return;
    const startDate = new Date(blockStart);
    const endDate = new Date(blockEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      setBlockStatus("Choose a valid start and end time.");
      return;
    }
    setBlockStatus("Adding time to Outlook…");
    const response = await fetch("/api/microsoft/calendar-blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true, calendarId: selectedCalendarIds[0] || "default", subject, start: startDate.toISOString(), end: endDate.toISOString(), timeZone: "UTC" }) });
    const data = await response.json().catch(() => ({}));
    setBlockStatus(response.ok ? `${subject} added to Outlook.` : (data.error || "Could not add time to Outlook."));
    if (response.ok) setShowBlockForm(false);
  }

  const eventsByDay = useMemo(() => weekDays.map((day) => events.filter((event) => {
    const start = event.start?.dateTime ? new Date(event.start.dateTime) : null;
    return start && start.toDateString() === day.toDateString();
  })), [events, weekDays]);

  const adaptivePlan = useMemo(() => {
    const now = new Date();
    const todayEvents = events.filter((event) => {
      const start = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      return start && start.toDateString() === now.toDateString();
    });
    const timedEvents = todayEvents.map((event) => ({ event, range: eventRange(event) })).filter((item): item is { event: Event; range: { start: Date; end: Date } } => Boolean(item.range));
    const remainingEvents = timedEvents.filter(({ range }) => range.end > now).sort((a, b) => a.range.start.getTime() - b.range.start.getTime());
    const futureMeetings = remainingEvents.filter(({ event, range }) => range.start > now && attendeesFor(event).length > 0 && event.id);
    const nextMeeting = futureMeetings[0]?.event;
    const nextEvent = remainingEvents[0]?.event;
    const lunchEvent = todayEvents.some((event) => /\b(lunch|meal|breakfast|dinner)\b/i.test(event.subject || ""));
    const lunchWindow = !lunchEvent && now.getHours() < 14 ? findOpenWindow(todayEvents, 30, 11, 14) : null;
    const resetWindow = findOpenWindow(todayEvents, 20, 9, 18);
    const longWorkWindow = findOpenWindow(todayEvents, 60, 9, 18);
    const sortedRanges = timedEvents.filter(({ range }) => range.end > now).sort((a, b) => a.range.start.getTime() - b.range.start.getTime());
    const hasBackToBackMeetings = sortedRanges.some((item, index) => {
      const next = sortedRanges[index + 1];
      return Boolean(next && next.range.start.getTime() - item.range.end.getTime() <= 15 * 60 * 1000);
    });
    const meetingSoon = Boolean(nextMeeting && nextMeeting.start?.dateTime && new Date(nextMeeting.start.dateTime).getTime() - now.getTime() <= 2 * 60 * 60 * 1000);
    const dayIsNearlyOver = now.getHours() >= 16;
    const blockActionLabel = calendarWriteEnabled ? "Add to calendar" : "Review calendar permissions";
    const blockActionKind = calendarWriteEnabled ? "block" : "settings" as const;
    const suggestions: CalendarSuggestion[] = [];
    const firstWindow = resetWindow || longWorkWindow;
    const scheduleSignal = remainingEvents.length === 0
      ? "No events remain on your calendar today."
      : firstWindow
        ? `${remainingEvents.length} event${remainingEvents.length === 1 ? "" : "s"} remain today, with a ${Math.round((firstWindow.end.getTime() - firstWindow.start.getTime()) / 60000)}-minute opening at ${formatTime(firstWindow.start.toISOString())}.`
        : `${remainingEvents.length} event${remainingEvents.length === 1 ? "" : "s"} remain today${nextEvent?.start?.dateTime ? `; next up is ${nextEvent.subject || "your next event"} at ${formatTime(nextEvent.start.dateTime)}.` : "."}`;

    if (dayIsNearlyOver && remainingEvents.length === 0) {
      suggestions.push({
        title: "Wind down your day",
        description: "You have no more meetings today. Capture anything unfinished, reflect on what helped, or make a simple plan for tomorrow.",
        actionLabel: "Review your schedule",
        actionKind: "review",
      });
    } else if (meetingSoon && nextMeeting) {
      suggestions.push({
        title: `Prepare for ${nextMeeting.subject || "your next meeting"}`,
        description: `You have this meeting at ${formatTime(nextMeeting.start?.dateTime)}. Name the outcome you want and think through what would help you feel ready.`,
        actionLabel: "Open meeting prep",
        href: `/dashboard/calendar/prep?event=${encodeURIComponent(nextMeeting.id || "")}&calendarId=${encodeURIComponent(nextMeeting.calendarId || "default")}&subject=${encodeURIComponent(nextMeeting.subject || "")}`,
      });
    } else if (!lunchEvent && now.getHours() < 14) {
      if (lunchWindow) {
        suggestions.push({
          title: "Make room for lunch",
          description: `You have an open window from ${formatTime(lunchWindow.start.toISOString())} to ${formatTime(lunchWindow.end.toISOString())}. It may be worth protecting it before another meeting lands there.`,
          actionLabel: blockActionLabel,
          actionKind: blockActionKind,
          start: localDateTimeValue(lunchWindow.start),
          end: localDateTimeValue(lunchWindow.end),
          blockType: "Lunch",
        });
      } else {
        suggestions.push({
          title: "There is no room for lunch yet",
          description: "You do not have a lunch break or reset time scheduled today. It may be worth moving or shortening a meeting so you have time to eat.",
          actionLabel: "Review your schedule",
          actionKind: "review",
        });
      }
    } else if (hasBackToBackMeetings) {
      suggestions.push({
        title: resetWindow ? "Protect a reset between meetings" : "Your meetings are back-to-back",
        description: resetWindow
          ? `There is a ${Math.round((resetWindow.end.getTime() - resetWindow.start.getTime()) / 60000)}-minute opening at ${formatTime(resetWindow.start.toISOString())}. A short reset could help before your next commitment.`
          : "There is no clear reset gap left today. It may be worth moving or shortening one meeting so you can recover between conversations.",
        actionLabel: resetWindow ? blockActionLabel : "Review your schedule",
        actionKind: resetWindow ? blockActionKind : "review",
        start: resetWindow ? localDateTimeValue(resetWindow.start) : undefined,
        end: resetWindow ? localDateTimeValue(resetWindow.end) : undefined,
        blockType: "Reset break",
      });
    } else if (longWorkWindow) {
      suggestions.push({
        title: "Choose a focus for your open block",
        description: `You have a longer opening from ${formatTime(longWorkWindow.start.toISOString())} to ${formatTime(longWorkWindow.end.toISOString())}. Choosing one outcome may make the time easier to use.`,
        actionLabel: blockActionLabel,
        actionKind: blockActionKind,
        start: localDateTimeValue(longWorkWindow.start),
        end: localDateTimeValue(longWorkWindow.end),
        blockType: "Focus time",
        secondary: [{ label: "Plan a reset instead", blockType: "Reset break" }, { label: "Add personal time", blockType: "Personal time" }],
      });
    } else if (remainingEvents.length === 0) {
      const openWindow = findOpenWindow([], 30, 9, 18);
      suggestions.push({
        title: "Your calendar is open for the rest of today",
        description: "What would feel useful: choose a focus, plan a reset, or make room for personal time?",
        actionLabel: openWindow ? blockActionLabel : "Review your schedule",
        actionKind: openWindow ? blockActionKind : "review",
        start: openWindow ? localDateTimeValue(openWindow.start) : undefined,
        end: openWindow ? localDateTimeValue(openWindow.end) : undefined,
        blockType: "Focus time",
        secondary: [{ label: "Plan a reset", blockType: "Reset break" }, { label: "Add personal time", blockType: "Personal time" }],
      });
    } else {
      suggestions.push({
        title: "Choose what would help today",
        description: "Your remaining schedule has some structure. Choose one outcome for the next opening and leave room to recover between commitments.",
        actionLabel: resetWindow ? blockActionLabel : "Review your schedule",
        actionKind: resetWindow ? blockActionKind : "review",
        start: resetWindow ? localDateTimeValue(resetWindow.start) : undefined,
        end: resetWindow ? localDateTimeValue(resetWindow.end) : undefined,
        blockType: "Focus time",
      });
    }

    const meetingPrepSuggestion: CalendarSuggestion | null = nextMeeting ? {
      title: `Prepare for ${nextMeeting.subject || "your next meeting"}`,
      description: `You have this meeting at ${formatTime(nextMeeting.start?.dateTime)}. Name the outcome you want and think through what would help you feel ready.`,
      actionLabel: "Open meeting prep",
      href: `/dashboard/calendar/prep?event=${encodeURIComponent(nextMeeting.id || "")}&calendarId=${encodeURIComponent(nextMeeting.calendarId || "default")}&subject=${encodeURIComponent(nextMeeting.subject || "")}`,
    } : null;
    return { suggestions, meetingPrepSuggestion, scheduleSignal };
  }, [calendarWriteEnabled, events]);

  const suggestions = adaptivePlan.suggestions;
  const scheduleSignal = adaptivePlan.scheduleSignal;
  const meetingPrepSuggestions = adaptivePlan.meetingPrepSuggestion ? [adaptivePlan.meetingPrepSuggestion] : [];
  const planningSuggestions = suggestions.filter((suggestion) => !suggestion.href);

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Calendar &amp; Meetings</h1>
          <p className="mt-2 text-sm text-ink-mid">See what is ahead and prepare before you walk in.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setWeekStart((current) => { const next = new Date(current); next.setDate(next.getDate() - 7); return next; })} className="rounded-pill border border-border bg-white px-4 py-2 text-sm text-ink hover:bg-bg">← Previous week</button>
          <button type="button" onClick={() => setWeekStart(mondayFor(new Date()))} className="rounded-pill border border-border bg-white px-4 py-2 text-sm text-ink hover:bg-bg">This week</button>
          <button type="button" onClick={() => setWeekStart((current) => { const next = new Date(current); next.setDate(next.getDate() + 7); return next; })} className="rounded-pill border border-border bg-white px-4 py-2 text-sm text-ink hover:bg-bg">Next week →</button>
        </div>
      </div>

      {!loading && meetingPrepSuggestions.length > 0 && <section className="mb-5 rounded-card border border-primary/20 bg-primary-light/20 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Suggested meeting prep</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {meetingPrepSuggestions.map((suggestion) => <article key={suggestion.title} className="rounded-sm border border-border bg-white p-4">
            <h2 className="text-sm font-medium text-ink">{suggestion.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-mid">{suggestion.description}</p>
            {suggestion.href && <Link href={suggestion.href} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">{suggestion.actionLabel} →</Link>}
          </article>)}
        </div>
      </section>}

      {error && <div className="mb-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {connected === false ? (
        <section className="rounded-card border border-border bg-white p-8 text-center">
          <p className="mb-3 text-3xl">📅</p>
          <h2 className="text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Connect Outlook to see your week</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-mid">Beckett reads only the calendar details you choose and keeps access read-only. Connect Microsoft 365 in Settings, then return here to select calendars and prepare for meetings.</p>
          <Link href="/dashboard/settings#connected-accounts" className="mt-5 inline-flex rounded-pill bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-dark">Connect Microsoft 365</Link>
        </section>
      ) : (
        <>
          <section className="mb-5 rounded-card border border-border bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Your week</p>
                <h2 className="mt-1 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{formatDay(weekDays[0])} – {formatDay(weekDays[6])}</h2>
              </div>
              <button type="button" onClick={() => setShowCalendarSettings((visible) => !visible)} className="rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light">{showCalendarSettings ? "Close calendar choices" : "Change connected calendars"}</button>
            </div>
            {showCalendarSettings && (
              <div className="mt-5 border-t border-border pt-5">
                <p className="text-sm font-medium text-ink">Calendars Beckett can see</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {calendars.map((calendar) => {
                    const id = calendar.id || "";
                    return <label key={id} className="flex items-center gap-3 rounded-sm border border-border px-3 py-2 text-sm text-ink"><input type="checkbox" checked={selectedCalendarIds.includes(id)} onChange={(event) => setSelectedCalendarIds((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} /> <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: calendar.hexColor || calendar.color || "#bf7513" }} /> {calendar.name || "Unnamed calendar"}</label>;
                  })}
                </div>
                <button type="button" onClick={() => void saveCalendarSelection()} disabled={savingCalendars || !selectedCalendarIds.length} className="mt-4 rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{savingCalendars ? "Saving…" : "Save calendar choices"}</button>
              </div>
            )}
          </section>

          {!loading && planningSuggestions.length > 0 && <section className="mb-5 rounded-card border border-primary/20 bg-primary-light/20 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">What would help today?</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-mid">{scheduleSignal}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {planningSuggestions.map((suggestion) => <article key={suggestion.title} className="rounded-sm border border-border bg-white p-4">
                <h2 className="text-sm font-medium text-ink">{suggestion.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-mid">{suggestion.description}</p>
                {suggestion.href ? <Link href={suggestion.href} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">{suggestion.actionLabel} →</Link> : suggestion.actionKind === "settings" ? <Link href="/dashboard/settings#connected-accounts" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">{suggestion.actionLabel} →</Link> : suggestion.actionKind === "review" ? <button type="button" onClick={() => setScheduleReviewVisible(true)} className="mt-3 rounded-pill border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light">{suggestion.actionLabel}</button> : suggestion.actionKind === "block" && suggestion.actionLabel && suggestion.start && suggestion.end ? <button type="button" onClick={() => openBlockForm(suggestion.start || "", suggestion.end || "", suggestion.blockType || "Reset break")} className="mt-3 rounded-pill border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light">{suggestion.actionLabel}</button> : null}
                {calendarWriteEnabled && suggestion.secondary && suggestion.start && suggestion.end && <div className="mt-3 flex flex-wrap gap-2">{suggestion.secondary.map((secondary) => <button key={secondary.label} type="button" onClick={() => openBlockForm(suggestion.start || "", suggestion.end || "", secondary.blockType)} className="text-xs text-primary hover:underline">{secondary.label}</button>)}</div>}
              </article>)}
            </div>
          </section>}

          {scheduleReviewVisible && <div className="mb-5 rounded-sm border border-primary/20 bg-primary-light/20 p-4" role="status">
            <p className="text-sm font-medium text-ink">Beckett did not find an open block.</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-mid">Review the meetings below and decide whether one can move or shorten. Beckett will not move meetings automatically.</p>
            <button type="button" onClick={() => document.getElementById("week-calendar")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-3 text-xs font-medium text-primary hover:underline">Review the schedule below →</button>
          </div>}

          {showBlockForm && <section className="mb-5 rounded-card border border-primary/20 bg-primary-light/30 p-5">
            <p className="text-sm font-medium text-ink">Add time to Outlook</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-mid">Times use your browser&apos;s local timezone. Beckett will create the event only after you confirm.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-ink-mid">What should this be called?<select value={blockType} onChange={(event) => setBlockType(event.target.value)} className="mt-1 block w-full rounded-sm border border-border bg-white px-2 py-2 text-sm text-ink"><option>Lunch</option><option>Reset break</option><option>Focus time</option><option>Walk</option><option>Custom</option></select></label>
              {blockType === "Custom" && <label className="text-xs text-ink-mid">Custom name<input value={customBlockName} onChange={(event) => setCustomBlockName(event.target.value)} placeholder="e.g. Coffee and reset" className="mt-1 block w-full rounded-sm border border-border bg-white px-2 py-2 text-sm text-ink" /></label>}
              <label className="text-xs text-ink-mid">Start<input type="datetime-local" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} className="mt-1 block w-full rounded-sm border border-border bg-white px-2 py-2 text-sm text-ink" /></label>
              <label className="text-xs text-ink-mid">End<input type="datetime-local" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} className="mt-1 block w-full rounded-sm border border-border bg-white px-2 py-2 text-sm text-ink" /></label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void createProtectedBreak()} className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Confirm and add</button><button type="button" onClick={() => setShowBlockForm(false)} className="rounded-pill border border-border bg-white px-4 py-2 text-sm text-ink hover:bg-bg">Cancel</button></div>
            {blockStatus && <p className="mt-2 text-xs text-ink-mid" role="status">{blockStatus}</p>}
          </section>}

          {loading ? <div className="rounded-card border border-border bg-white p-8 text-center text-sm text-ink-mid">Loading your Outlook week…</div> : (
            <section id="week-calendar" className="grid gap-3 md:grid-cols-7">
              {weekDays.map((day, index) => (
                <div key={day.toISOString()} className="min-h-56 rounded-card border border-border bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-light">{formatDay(day)}</p>
                  <div className="mt-3 space-y-2">
                    {eventsByDay[index].length ? eventsByDay[index].map((event) => {
                      const attendees = attendeesFor(event);
                      return <article key={event.id || `${event.subject}-${event.start?.dateTime}`} className={`rounded-sm border px-3 py-3 ${event.isCancelled ? "border-red-200 bg-red-50" : "border-primary/20 bg-primary-light/30"}`}>
                        <p className="text-[11px] font-medium text-primary">{event.isAllDay ? "All day" : `${formatTime(event.start?.dateTime)}${event.end?.dateTime ? `–${formatTime(event.end.dateTime)}` : ""}`}</p>
                        <h3 className="mt-1 text-sm font-medium leading-snug text-ink">{event.subject || "Untitled event"}</h3>
                        {event.location?.displayName && <p className="mt-1 truncate text-[11px] text-ink-mid">{event.location.displayName}</p>}
                        {attendees.length > 0 ? <p className="mt-2 text-[11px] text-ink-mid">{attendees.length} attendee{attendees.length === 1 ? "" : "s"}</p> : <p className="mt-2 text-[11px] text-ink-light">No other attendees</p>}
                        {attendees.length > 0 && event.id && <Link href={`/dashboard/calendar/prep?event=${encodeURIComponent(event.id)}&calendarId=${encodeURIComponent(event.calendarId || "default")}&subject=${encodeURIComponent(event.subject || "")}`} className="mt-2 inline-block text-[11px] font-medium text-primary hover:underline">Prep for this meeting →</Link>}
                      </article>;
                    }) : <p className="py-4 text-xs text-ink-light">Nothing scheduled</p>}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
