"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { timeOfDayForDate, type WorkdayCheckin } from "@/lib/workday-patterns";
import {
  attendeeNames,
  eventsOnDay,
  formatEventTime,
  getDaySuggestion,
  hasOtherAttendees,
  type CalendarEvent,
} from "@/lib/calendar-insights";
import {
  formatCalendarActionIntent,
  type CalendarActionIntent,
} from "@/lib/calendar-action-intents";

type Calendar = { connected: boolean; reauthorize?: boolean; events: CalendarEvent[] };
type Feeling = {
  value: string;
  label: string;
  symbol: string;
  checkin: Pick<WorkdayCheckin, "workload_level" | "energy_level" | "communication_friction" | "break_status" | "helpful_strategy">;
};

type SupportChoice = {
  label: string;
  detail: string;
  strategy: Feeling["checkin"]["helpful_strategy"];
  action: "short_walk" | "food_or_water" | "quiet_minutes" | "smaller_next_step" | "plan_priority" | "prepare_next" | "ask_for_time";
};

type PendingSupportAction = {
  id: string;
  action_type: SupportChoice["action"];
};

const feelings: Feeling[] = [
  { value: "steady", label: "Steady", symbol: "〰", checkin: { workload_level: "steady", energy_level: 3, communication_friction: false, break_status: "not_taken", helpful_strategy: "none_yet" } },
  { value: "low-energy", label: "Low energy", symbol: "▱", checkin: { workload_level: "steady", energy_level: 2, communication_friction: false, break_status: "would_help", helpful_strategy: "short_break" } },
  { value: "stressed", label: "Stressed", symbol: "✳", checkin: { workload_level: "stacked", energy_level: 2, communication_friction: true, break_status: "would_help", helpful_strategy: "clearer_priority" } },
  { value: "focused", label: "Focused", symbol: "◎", checkin: { workload_level: "steady", energy_level: 4, communication_friction: false, break_status: "not_taken", helpful_strategy: "quiet_block" } },
  { value: "overloaded", label: "Overloaded", symbol: "☁", checkin: { workload_level: "stacked", energy_level: 1, communication_friction: true, break_status: "would_help", helpful_strategy: "short_break" } },
];

const supportChoices: Record<string, SupportChoice[]> = {
  "low-energy": [
    { label: "Take a short walk", detail: "A little movement or fresh air before your next thing.", strategy: "short_break", action: "short_walk" },
    { label: "Get food, water, or coffee", detail: "A practical reset for your energy.", strategy: "short_break", action: "food_or_water" },
    { label: "Take five quiet minutes", detail: "A smaller pause without needing to go anywhere.", strategy: "quiet_block", action: "quiet_minutes" },
    { label: "Choose a smaller next task", detail: "Make the next step easier to start.", strategy: "clearer_priority", action: "smaller_next_step" },
  ],
  stressed: [
    { label: "Plan the next priority", detail: "Choose one thing that matters most right now.", strategy: "clearer_priority", action: "plan_priority" },
    { label: "Take a short reset", detail: "Make room to breathe before the next commitment.", strategy: "short_break", action: "quiet_minutes" },
    { label: "Prepare for what is next", detail: "Write down the outcome or question you want to bring.", strategy: "draft_before_sending", action: "prepare_next" },
    { label: "Find some quiet", detail: "Protect a brief block without new requests.", strategy: "quiet_block", action: "quiet_minutes" },
  ],
  overloaded: [
    { label: "Choose one next step", detail: "Reduce the day to one useful thing for now.", strategy: "clearer_priority", action: "smaller_next_step" },
    { label: "Ask for more time", detail: "Prepare a clear way to pause or reset an expectation.", strategy: "draft_before_sending", action: "ask_for_time" },
    { label: "Take a short reset", detail: "Step away briefly before deciding what is next.", strategy: "short_break", action: "quiet_minutes" },
    { label: "Find some quiet", detail: "Create a little space from competing requests.", strategy: "quiet_block", action: "quiet_minutes" },
  ],
};

function prepHref(event: CalendarEvent) {
  return `/dashboard/meeting-prep?title=${encodeURIComponent(event.title)}&attendees=${encodeURIComponent(attendeeNames(event).join(", "))}`;
}

function practiceHref(event: CalendarEvent) {
  const attendees = attendeeNames(event).slice(0, 2).join(" and ");
  return `/dashboard/practice?mode=professional&scenario=${encodeURIComponent(`Prepare for ${event.title}`)}&goal=${encodeURIComponent(`Practice a clear contribution or ask${attendees ? ` for my conversation with ${attendees}` : ""}.`)}`;
}

export default function TodayGuide({ name }: { name: string }) {
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<"loading" | "ready" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [pendingFeeling, setPendingFeeling] = useState<Feeling | null>(null);
  const [checkinStatus, setCheckinStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [holdPlanVisible, setHoldPlanVisible] = useState(false);
  const [holdCopied, setHoldCopied] = useState(false);
  const [calendarActionIntent, setCalendarActionIntent] = useState<CalendarActionIntent | null>(null);
  const [openDayPlanner, setOpenDayPlanner] = useState(false);
  const [openDayChoice, setOpenDayChoice] = useState<string | null>(null);
  const [customOpenDayFocus, setCustomOpenDayFocus] = useState("");
  const [pendingSupportAction, setPendingSupportAction] = useState<PendingSupportAction | null>(null);
  const [supportFollowUpStatus, setSupportFollowUpStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    setCalendarStatus("loading");
    try {
      const response = await fetch("/api/calendar/events", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as Calendar | null;
      if (!response.ok || !data) throw new Error("Calendar could not load.");
      setCalendar(data);
      setUpdatedAt(new Date());
      setCalendarStatus("ready");
    } catch {
      setCalendarStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [load]);

  useEffect(() => {
    fetch("/api/workday/checkins", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { pendingAction?: PendingSupportAction | null } | null) => setPendingSupportAction(data?.pendingAction || null))
      .catch(() => setPendingSupportAction(null));
  }, []);

  const today = useMemo(() => eventsOnDay(calendar?.events || [], new Date()), [calendar]);
  const suggestion = useMemo(() => getDaySuggestion(calendar?.events || [], new Date()), [calendar]);
  const nextMeetingToPrep = useMemo(() => today.filter((event) => new Date(event.start).getTime() >= Date.now()).find(hasOtherAttendees), [today]);

  async function saveCheckin(feeling: Feeling, strategy = feeling.checkin.helpful_strategy, action?: SupportChoice["action"]) {
    setSelectedFeeling(feeling.value);
    setPendingFeeling(null);
    setCheckinStatus("saving");
    try {
      const response = await fetch("/api/workday/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...feeling.checkin, helpful_strategy: strategy, time_of_day: timeOfDayForDate(), ...(action ? { support_action: action } : {}) }),
      });
      if (!response.ok) throw new Error();
      setCheckinStatus("saved");
    } catch {
      setCheckinStatus("error");
    }
  }

  async function saveSupportOutcome(outcome: "helped" | "a_little" | "not_helpful" | "skipped") {
    if (!pendingSupportAction) return;
    setSupportFollowUpStatus("saving");
    try {
      const response = await fetch(`/api/workday/support-actions/${pendingSupportAction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!response.ok) throw new Error();
      setPendingSupportAction(null);
      setSupportFollowUpStatus("saved");
    } catch {
      setSupportFollowUpStatus("error");
    }
  }

  function selectFeeling(feeling: Feeling) {
    setSelectedFeeling(feeling.value);
    setCheckinStatus("idle");
    if (feeling.value === "steady" || feeling.value === "focused") {
      void saveCheckin(feeling);
      return;
    }
    setPendingFeeling(feeling);
  }

  async function copySuggestedHold() {
    if (!suggestion.suggestedHold) return;
    const { title, start, end } = suggestion.suggestedHold;
    const details = `${title}: ${formatEventTime(start)}–${formatEventTime(end)}`;
    try {
      await navigator.clipboard.writeText(details);
      setHoldCopied(true);
    } catch {
      setHoldCopied(false);
    }
  }

  function stageSuggestedHold() {
    if (!suggestion.suggestedHold) return;
    setCalendarActionIntent({
      kind: "create_hold",
      title: suggestion.suggestedHold.title,
      start: suggestion.suggestedHold.start,
      end: suggestion.suggestedHold.end,
      source: "home_schedule_suggestion",
    });
  }

  function chooseOpenDayFocus(choice: string) {
    setOpenDayChoice(choice);
    if (typeof window !== "undefined") window.sessionStorage.setItem("beckett:today-intention", choice);
  }

  return (
    <section className="mb-6 space-y-5">
      <div className="rounded-card border border-border bg-white p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Today with Beckett</p>
        <h2 className="mt-2 text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {name}.</h2>
        <p className="mt-1 text-sm text-ink-mid">How are you feeling right now?</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-5">
          {feelings.map((feeling) => <button key={feeling.value} type="button" onClick={() => void selectFeeling(feeling)} aria-pressed={selectedFeeling === feeling.value} disabled={checkinStatus === "saving"} className={`flex min-h-16 items-center gap-3 rounded-sm border px-3 text-left text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${selectedFeeling === feeling.value ? "border-primary bg-primary-light text-ink" : "border-border bg-bg/50 text-ink hover:border-primary/50 hover:bg-primary-light/40"}`}><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-lg text-primary">{feeling.symbol}</span>{feeling.label}</button>)}
        </div>
        {pendingFeeling && <div className="mt-5 rounded-sm border border-primary/20 bg-primary-light/35 p-4"><p className="text-sm font-medium text-ink">{pendingFeeling.value === "low-energy" ? "What might help with your energy right now?" : pendingFeeling.value === "stressed" ? "What would make the next part of your day easier?" : "What would help make the day feel lighter right now?"}</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">{calendar?.connected && today.length ? `Beckett is using today’s ${today.length === 1 ? "scheduled commitment" : `${today.length} scheduled commitments`} as context, but you decide what fits.` : "Choose only what sounds useful. Beckett will not assume you completed it."}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{(supportChoices[pendingFeeling.value] || []).map((choice) => <button key={choice.label} type="button" onClick={() => void saveCheckin(pendingFeeling, choice.strategy, choice.action)} className="rounded-sm border border-border bg-white p-3 text-left transition-colors hover:border-primary hover:bg-primary-light/30"><span className="block text-sm font-medium text-ink">{choice.label}</span><span className="mt-1 block text-xs text-ink-mid">{choice.detail}</span></button>)}</div><button type="button" onClick={() => void saveCheckin(pendingFeeling, "none_yet")} className="mt-3 text-xs font-medium text-primary hover:underline">Nothing right now — just save my check-in</button></div>}
        {pendingSupportAction && <div className="mt-5 rounded-sm border border-primary/20 bg-white p-4"><p className="text-sm font-medium text-ink">Did that last reset help at all?</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">Your answer helps Beckett learn what to offer you. You can skip it if you do not want to say.</p><div className="mt-3 flex flex-wrap gap-2">{([ ["helped", "Yes, it helped"], ["a_little", "A little"], ["not_helpful", "Not really"], ["skipped", "Skip" ] ] as const).map(([outcome, label]) => <button key={outcome} type="button" disabled={supportFollowUpStatus === "saving"} onClick={() => void saveSupportOutcome(outcome)} className="rounded-pill border border-primary/30 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light disabled:opacity-60">{label}</button>)}</div></div>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {checkinStatus === "saving" && <span className="text-ink-mid">Saving your check-in…</span>}
          {checkinStatus === "saved" && <span className="text-primary">Check-in saved at {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. You can check in again anytime.</span>}
          {checkinStatus === "error" && <span className="text-red-700">Your check-in did not save. Please try again.</span>}
          {supportFollowUpStatus === "saved" && <span className="text-primary">Thanks — Beckett will use that only in your private pattern learning.</span>}
          {supportFollowUpStatus === "error" && <span className="text-red-700">Your feedback did not save. Please try again.</span>}
          <Link href="/dashboard/about#support-preferences" className="font-medium text-primary hover:underline">View support preferences →</Link>
          <Link href="/dashboard/settings#workday-reminders" className="font-medium text-primary hover:underline">Set up reminders to check in →</Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Your day</p><h3 className="mt-1 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>What&apos;s ahead</h3></div><button type="button" onClick={() => void load()} className="text-xs font-medium text-primary hover:underline">Refresh</button></div>
          {calendarStatus === "loading" ? <p className="mt-5 rounded-sm border border-border bg-bg/60 p-4 text-sm text-ink-mid">Loading the calendars you selected…</p> : calendarStatus === "error" ? <div className="mt-5 rounded-sm border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800">Beckett could not refresh your calendar right now. Your connection has not changed. <button type="button" onClick={() => void load()} className="font-medium underline">Try again</button></div> : calendar?.connected && !calendar.reauthorize ? (
            today.length ? <div className="mt-5 space-y-3">{today.slice(0, 5).map((event) => <article key={event.id} className="rounded-sm border border-border bg-bg/60 p-4"><p className="text-xs font-medium text-primary">{formatEventTime(event.start)}</p><p className="mt-1 text-sm font-medium text-ink">{event.title}</p>{hasOtherAttendees(event) && <Link href={prepHref(event)} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Prep for this meeting →</Link>}</article>)}</div> : <p className="mt-5 rounded-sm border border-border bg-bg/60 p-4 text-sm text-ink-mid">Your calendar is clear today. What would help you make the day feel good?</p>
          ) : <div className="mt-5 rounded-sm border border-primary/20 bg-primary-light/40 p-4 text-sm leading-relaxed text-ink-mid">Connect Google Calendar to see your day here and prepare for upcoming meetings. <Link href="/dashboard/settings#connected-accounts" className="font-medium text-primary hover:underline">Connect calendar →</Link></div>}
          {updatedAt && <p className="mt-4 text-xs text-ink-light">Updated {formatEventTime(updatedAt.toISOString())}</p>}
        </div>

        <div className="space-y-5">
          {!suggestionDismissed && <div className="rounded-card border border-primary/20 bg-primary-light/40 p-5 sm:p-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">A schedule-based suggestion</p><h3 className="mt-2 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{calendarStatus === "loading" ? "Checking what is ahead…" : calendar?.connected ? suggestion.title : "Start with what would help today."}</h3><p className="mt-2 text-sm leading-relaxed text-ink-mid">{calendarStatus === "loading" ? "Beckett is refreshing the calendars you selected." : calendar?.connected ? suggestion.detail : "Connect your calendar when you want Beckett to tailor this to your actual schedule."}</p>{openDayPlanner && <div className="mt-4 rounded-sm border border-primary/20 bg-white/80 p-4"><p className="text-sm font-medium text-ink">What would make today feel worthwhile?</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{["Make progress on work", "Take care of myself", "Get organized", "Prepare for something ahead", "I’m not sure yet"].map((choice) => <button key={choice} type="button" onClick={() => chooseOpenDayFocus(choice)} aria-pressed={openDayChoice === choice} className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${openDayChoice === choice ? "border-primary bg-primary-light" : "border-border bg-white hover:border-primary"}`}>{choice}</button>)}</div><label className="mt-3 block text-xs font-medium text-ink">Or write your own focus<input value={customOpenDayFocus} onChange={(event) => setCustomOpenDayFocus(event.target.value)} onBlur={() => customOpenDayFocus.trim() && chooseOpenDayFocus(customOpenDayFocus.trim())} placeholder="One thing that would make today feel better" className="mt-1 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" /></label>{openDayChoice && <p className="mt-3 text-xs text-ink-mid">Beckett will keep “{openDayChoice}” in view for this visit. Nothing is added to your calendar.</p>}</div>}{holdPlanVisible && suggestion.suggestedHold && <div className="mt-4 rounded-sm border border-primary/20 bg-white/80 p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Proposed calendar hold</p><p className="mt-1 text-sm font-medium text-ink">{suggestion.suggestedHold.title} · {formatEventTime(suggestion.suggestedHold.start)}–{formatEventTime(suggestion.suggestedHold.end)}</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">This is only a suggestion. Beckett has not added anything to your calendar.</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><button type="button" onClick={() => void copySuggestedHold()} className="text-xs font-medium text-primary hover:underline">{holdCopied ? "Copied" : "Copy hold details"}</button><button type="button" onClick={stageSuggestedHold} className="text-xs font-medium text-primary hover:underline">{calendarActionIntent ? "Reviewed for a future calendar action" : "Review for a future calendar action"}</button></div></div>}{calendarActionIntent && <p className="mt-3 text-xs leading-relaxed text-ink-mid">Beckett has staged “{formatCalendarActionIntent(calendarActionIntent)}” only in this page. Calendar edits are not enabled, and nothing has been sent to Google.</p>}<div className="mt-5 flex flex-wrap gap-3">{suggestion.kind === "prep" && suggestion.event ? <Link href={prepHref(suggestion.event)} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark">Prepare now</Link> : suggestion.kind === "open" ? <button type="button" onClick={() => setOpenDayPlanner((value) => !value)} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark">{openDayPlanner ? "Close day planner" : "Plan your open day"}</button> : suggestion.suggestedHold ? <button type="button" onClick={() => setHoldPlanVisible((visible) => !visible)} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark">{holdPlanVisible ? "Hide proposed hold" : "Review proposed hold"}</button> : <Link href={suggestion.kind === "focus" ? "/dashboard/skills" : "/dashboard/workday"} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark">{suggestion.kind === "focus" ? "Choose a useful skill" : "Plan a reset"}</Link>}<button type="button" onClick={() => setSuggestionDismissed(true)} className="rounded-pill border border-primary/30 bg-white px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light">Not today</button></div></div>}

          <div className="rounded-card border border-border bg-white"><button type="button" onClick={() => setSetupOpen((open) => !open)} aria-expanded={setupOpen} className="flex w-full items-center justify-between p-5 text-left"><span><span className="block text-xs font-medium uppercase tracking-wide text-ink-light">Set up your day</span><span className="mt-1 block text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{calendar?.connected ? "Choose support that fits what is ahead." : "Choose what would help today."}</span></span><span aria-hidden="true" className="text-xl text-primary">{setupOpen ? "−" : "+"}</span></button>{setupOpen && <div className="grid border-t border-border sm:grid-cols-3">{nextMeetingToPrep ? <><Link href={prepHref(nextMeetingToPrep)} className="border-b border-border p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">Prepare for {nextMeetingToPrep.title}</span><span className="mt-1 block text-xs font-normal text-ink-mid">Meeting with {attendeeNames(nextMeetingToPrep).slice(0, 2).join(", ")}.</span></Link><Link href={practiceHref(nextMeetingToPrep)} className="border-b border-border p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">Practice this conversation</span><span className="mt-1 block text-xs font-normal text-ink-mid">Rehearse a clear contribution or ask before you walk in.</span></Link></> : <button type="button" onClick={() => setOpenDayPlanner(true)} className="border-b border-border p-4 text-left text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">Plan your open day</span><span className="mt-1 block text-xs font-normal text-ink-mid">Choose progress, self-care, organization, preparation, or your own focus.</span></button>}<Link href="/dashboard/about#support-preferences" className="border-b border-border p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">My support preferences</span><span className="mt-1 block text-xs font-normal text-ink-mid">Review the support you want Beckett to offer.</span></Link><Link href="/dashboard/calendar" className="p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40"><span className="block text-primary">View your week</span><span className="mt-1 block text-xs font-normal text-ink-mid">See the meetings and open space Beckett is using.</span></Link></div>}</div>
        </div>
      </div>
    </section>
  );
}
