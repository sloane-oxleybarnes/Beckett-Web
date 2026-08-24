"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { timeOfDayForDate, type CalendarContext, type WorkdayCheckin } from "@/lib/workday-patterns";
import { workdayPlanDate } from "@/lib/workday-planning";
import {
  attendeeNames,
  eventsOnDay,
  formatEventTime,
  findConsecutiveMeetingStretch,
  getDaySuggestion,
  hasLunchOpening,
  hasOtherAttendees,
  type CalendarEvent,
} from "@/lib/calendar-insights";
import { hasEarnedMeetingPrepSignal, type MeetingPrepContact } from "@/lib/meeting-prep-recommendations";
import type { EarnedLearningRecommendation } from "@/lib/earned-learning-recommendations";

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

type OpenDayPlan = {
  focus: string;
  nextStep: string;
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
  const [now, setNow] = useState(() => new Date());
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
  const [openDayPlanner, setOpenDayPlanner] = useState(false);
  const [openDayChoice, setOpenDayChoice] = useState<string | null>(null);
  const [customOpenDayFocus, setCustomOpenDayFocus] = useState("");
  const [openDayNextStep, setOpenDayNextStep] = useState("");
  const [savedOpenDayPlan, setSavedOpenDayPlan] = useState<OpenDayPlan | null>(null);
  const [openDayPlanStatus, setOpenDayPlanStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dayPlannerRef = useRef<HTMLDivElement | null>(null);
  const [pendingSupportAction, setPendingSupportAction] = useState<PendingSupportAction | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<"helped" | "a_little" | "not_helpful" | "skipped" | null>(null);
  const [supportFollowUpStatus, setSupportFollowUpStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [customSupport, setCustomSupport] = useState("");
  const [, setHomeSuggestionsEnabled] = useState(true);
  const [meetingPrepLearningEnabled, setMeetingPrepLearningEnabled] = useState(false);
  const [contacts, setContacts] = useState<MeetingPrepContact[]>([]);
  const [learningRecommendation, setLearningRecommendation] = useState<EarnedLearningRecommendation | null>(null);
  const [learningWhyOpen, setLearningWhyOpen] = useState(false);
  const [learningFeedbackStatus, setLearningFeedbackStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [learningFeedbackError, setLearningFeedbackError] = useState<string | null>(null);
  const [learningPaused, setLearningPaused] = useState(false);
  const [localHour, setLocalHour] = useState<number | null>(null);

  useEffect(() => {
    setLocalHour(new Date().getHours());
  }, []);

  const load = useCallback(async () => {
    setCalendarStatus("loading");
    try {
      const refreshedAt = new Date();
      const dayStart = new Date(refreshedAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const response = await fetch(`/api/calendar/events?from=${encodeURIComponent(dayStart.toISOString())}&to=${encodeURIComponent(dayEnd.toISOString())}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as Calendar | null;
      if (!response.ok || !data) throw new Error("Calendar could not load.");
      setCalendar(data);
      setNow(refreshedAt);
      setUpdatedAt(refreshedAt);
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

  useEffect(() => {
    fetch("/api/learning/recommendation", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { recommendation?: EarnedLearningRecommendation | null } | null) => setLearningRecommendation(data?.recommendation || null))
      .catch(() => setLearningRecommendation(null));
  }, []);

  useEffect(() => {
    fetch("/api/learning/preferences", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { preferences?: { home_suggestions_enabled?: boolean; pattern_model_enabled?: boolean; skill_recommendations_enabled?: boolean; meeting_prep_learning_enabled?: boolean } } | null) => {
        const enabled = data?.preferences?.home_suggestions_enabled !== false;
        setHomeSuggestionsEnabled(enabled);
        setMeetingPrepLearningEnabled(Boolean(data?.preferences?.pattern_model_enabled && data?.preferences?.meeting_prep_learning_enabled));
        setLearningPaused(data?.preferences?.skill_recommendations_enabled === false);
        if (!enabled) setSuggestionDismissed(true);
      })
      .catch(() => setHomeSuggestionsEnabled(true));
  }, []);

  useEffect(() => {
    fetch("/api/contacts", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { contacts?: MeetingPrepContact[] } | null) => setContacts(data?.contacts || []))
      .catch(() => setContacts([]));
  }, []);

  const today = useMemo(() => eventsOnDay(calendar?.events || [], now), [calendar, now]);
  const upcomingToday = useMemo(() => today.filter((event) => new Date(event.start).getTime() >= now.getTime()), [now, today]);
  const suggestion = useMemo(() => {
    const base = getDaySuggestion(calendar?.events || [], now);
    const canRecommendPrep = Boolean(meetingPrepLearningEnabled && base.event && hasEarnedMeetingPrepSignal(base.event, contacts));
    return getDaySuggestion(calendar?.events || [], now, { recommendPrep: canRecommendPrep });
  }, [calendar, contacts, meetingPrepLearningEnabled, now]);
  const nextMeetingToPrep = useMemo(() => upcomingToday.find(hasOtherAttendees), [upcomingToday]);
  const calendarContext = useMemo<CalendarContext>(() => {
    const timed = today.filter((event) => event.end).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const elapsedMeetings = timed.filter((event) => new Date(event.end as string).getTime() <= now.getTime());
    const completedMeetingStretch = findConsecutiveMeetingStretch(elapsedMeetings);
    const middayStart = new Date(now);
    middayStart.setHours(11, 30, 0, 0);
    const middayEnd = new Date(now);
    middayEnd.setHours(14, 30, 0, 0);
    const middayMeetingStretch = findConsecutiveMeetingStretch(timed.filter((event) => (
      new Date(event.start).getTime() < middayEnd.getTime()
      && new Date(event.end as string).getTime() > middayStart.getTime()
    )));
    return {
      connected: Boolean(calendar?.connected && !calendar.reauthorize),
      event_count: today.length,
      meeting_count: today.filter(hasOtherAttendees).length,
      meeting_heavy: Boolean(completedMeetingStretch),
      no_lunch_opening: Boolean(middayMeetingStretch && !hasLunchOpening(timed, now)),
    };
  }, [calendar, now, today]);
  useEffect(() => {
    fetch(`/api/workday/day-plan?date=${workdayPlanDate()}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { plan?: { focus?: string; next_step?: string } | null } | null) => {
        const plan = data?.plan;
        if (!plan?.focus) return;
        setSavedOpenDayPlan({ focus: plan.focus, nextStep: plan.next_step || "" });
        setOpenDayChoice(plan.focus);
        setCustomOpenDayFocus(plan.focus);
        setOpenDayNextStep(plan.next_step || "");
      })
      .catch(() => undefined);
  }, []);

  async function saveCheckin(feeling: Feeling, strategy = feeling.checkin.helpful_strategy, action?: SupportChoice["action"]) {
    setSelectedFeeling(feeling.value);
    setPendingFeeling(null);
    setCheckinStatus("saving");
    try {
      const response = await fetch("/api/workday/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...feeling.checkin, helpful_strategy: strategy, time_of_day: timeOfDayForDate(), calendar_context: calendarContext, ...(action ? { support_action: action } : {}) }),
      });
      if (!response.ok) throw new Error();
      setCheckinStatus("saved");
    } catch {
      setCheckinStatus("error");
    }
  }

  async function saveSupportOutcome(outcome: "helped" | "a_little" | "not_helpful" | "skipped", rememberForLearning = false) {
    if (!pendingSupportAction) return;
    setSupportFollowUpStatus("saving");
    try {
      const response = await fetch(`/api/workday/support-actions/${pendingSupportAction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, remember_for_learning: rememberForLearning }),
      });
      if (!response.ok) throw new Error();
      setPendingSupportAction(null);
      setPendingOutcome(null);
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

  function chooseOpenDayFocus(choice: string) {
    setOpenDayChoice(choice);
    setCustomOpenDayFocus("");
    setOpenDayPlanStatus("idle");
  }

  async function saveOpenDayPlan() {
    const focus = customOpenDayFocus.trim() || openDayChoice || "";
    if (!focus) return;
    setOpenDayPlanStatus("saving");
    try {
      const response = await fetch("/api/workday/day-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus, next_step: openDayNextStep.trim(), plan_date: workdayPlanDate() }),
      });
      const data = await response.json().catch(() => null) as { plan?: { focus: string; next_step?: string }; error?: string } | null;
      if (!response.ok || !data?.plan) throw new Error(data?.error || "Could not save today's focus.");
      setSavedOpenDayPlan({ focus: data.plan.focus, nextStep: data.plan.next_step || "" });
      setOpenDayChoice(data.plan.focus);
      setCustomOpenDayFocus(data.plan.focus);
      setOpenDayNextStep(data.plan.next_step || "");
      setOpenDayPlanStatus("saved");
      setOpenDayPlanner(false);
    } catch {
      setOpenDayPlanStatus("error");
    }
  }

  async function recordLearningFeedback(action: "save" | "dismiss") {
    if (!learningRecommendation) return;
    setLearningFeedbackStatus("saving");
    setLearningFeedbackError(null);
    try {
      const response = await fetch("/api/learning/recommendation/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error();
      setLearningRecommendation(null);
      setLearningFeedbackStatus("saved");
    } catch {
      setLearningFeedbackStatus("error");
      setLearningFeedbackError("Could not save that choice. Please try again.");
    }
  }

  async function pauseLearningRecommendations() {
    setLearningFeedbackStatus("saving");
    setLearningFeedbackError(null);
    try {
      const response = await fetch("/api/learning/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_recommendations_enabled: false }),
      });
      if (!response.ok) throw new Error();
      setLearningPaused(true);
      setLearningRecommendation(null);
      setLearningFeedbackStatus("saved");
    } catch {
      setLearningFeedbackStatus("error");
      setLearningFeedbackError("Could not pause recommendations. Please try again.");
    }
  }

  function openPlanner() {
    setOpenDayPlanner(true);
  }

  useEffect(() => {
    if (!openDayPlanner) return;
    window.requestAnimationFrame(() => dayPlannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [openDayPlanner]);

  const greeting = localHour === null
    ? "Hello"
    : localHour < 12
      ? "Good morning"
      : localHour < 18
        ? "Good afternoon"
        : "Good evening";

  return (
    <section className="mb-6 space-y-5">
      <div id="today-checkin" className="rounded-card border border-border bg-white p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Today with Beckett</p>
        <h2 className="mt-2 text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{greeting}, {name}.</h2>
        <p className="mt-1 text-sm text-ink-mid">How are you feeling right now?</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-5">
          {feelings.map((feeling) => <button key={feeling.value} type="button" onClick={() => void selectFeeling(feeling)} aria-pressed={selectedFeeling === feeling.value} disabled={checkinStatus === "saving"} className={`flex min-h-16 items-center gap-3 rounded-sm border px-3 text-left text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${selectedFeeling === feeling.value ? "border-primary bg-primary-light text-ink" : "border-border bg-bg/50 text-ink hover:border-primary/50 hover:bg-primary-light/40"}`}><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-lg text-primary">{feeling.symbol}</span>{feeling.label}</button>)}
        </div>
        {pendingFeeling && <div className="mt-5 rounded-sm border border-primary/20 bg-primary-light/35 p-4"><p className="text-sm font-medium text-ink">{pendingFeeling.value === "low-energy" && calendarContext.meeting_heavy ? "You have had a meeting-heavy day. What might help before your next thing?" : pendingFeeling.value === "low-energy" ? "What might help with your energy right now?" : pendingFeeling.value === "stressed" ? "What would make the next part of your day easier?" : "What would help make the day feel lighter right now?"}</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">{calendarContext.connected ? "Beckett is using only the shape of today’s schedule as context. You decide what fits." : "Choose only what sounds useful. Beckett will not assume you completed it."}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{(supportChoices[pendingFeeling.value] || []).map((choice) => <button key={choice.label} type="button" onClick={() => void saveCheckin(pendingFeeling, choice.strategy, choice.action)} className="rounded-sm border border-border bg-white p-3 text-left transition-colors hover:border-primary hover:bg-primary-light/30"><span className="block text-sm font-medium text-ink">{choice.label}</span><span className="mt-1 block text-xs text-ink-mid">{choice.detail}</span></button>)}</div><label className="mt-3 block text-xs font-medium text-ink">Something else<input value={customSupport} onChange={(event) => setCustomSupport(event.target.value)} placeholder="Name your own next step (this is not stored)" className="mt-1 block w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal" /></label><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => void saveCheckin(pendingFeeling, "none_yet")} className="text-xs font-medium text-primary hover:underline">{customSupport.trim() ? "Save my check-in" : "Not now — just save my check-in"}</button><button type="button" onClick={() => setPendingFeeling(null)} className="text-xs font-medium text-ink-mid hover:underline">Go back</button></div></div>}
        {pendingSupportAction && <div className="mt-5 rounded-sm border border-primary/20 bg-white p-4"><p className="text-sm font-medium text-ink">Did that last reset help at all?</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">Your answer helps Beckett learn what to offer you. You can skip it if you do not want to say.</p>{!pendingOutcome ? <div className="mt-3 flex flex-wrap gap-2">{([ ["helped", "Yes, noticeably"], ["a_little", "A little"], ["not_helpful", "Not really"], ["skipped", "Skip" ] ] as const).map(([outcome, label]) => <button key={outcome} type="button" disabled={supportFollowUpStatus === "saving"} onClick={() => outcome === "skipped" ? void saveSupportOutcome(outcome) : setPendingOutcome(outcome)} className="rounded-pill border border-primary/30 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light disabled:opacity-60">{label}</button>)}</div> : <div className="mt-3 rounded-sm border border-border bg-bg/50 p-3"><p className="text-xs font-medium text-ink">Would you like Beckett to remember this as a private preference?</p><p className="mt-1 text-xs text-ink-mid">It will still ask before offering it again.</p><div className="mt-2 flex gap-3"><button type="button" onClick={() => void saveSupportOutcome(pendingOutcome, true)} className="text-xs font-medium text-primary hover:underline">Remember this</button><button type="button" onClick={() => void saveSupportOutcome(pendingOutcome, false)} className="text-xs font-medium text-ink-mid hover:underline">No thanks</button></div></div>}</div>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {checkinStatus === "saving" && <span className="text-ink-mid">Saving your check-in…</span>}
          {checkinStatus === "saved" && <span className="text-primary">Check-in saved at {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. You can check in again anytime.</span>}
          {checkinStatus === "error" && <span className="text-red-700">Your check-in did not save. Please try again.</span>}
          {supportFollowUpStatus === "saved" && <span className="text-primary">Thanks — Beckett will use that only in your private pattern learning.</span>}
          {supportFollowUpStatus === "error" && <span className="text-red-700">Your feedback did not save. Please try again.</span>}
          <Link href="/dashboard/about#support-preferences" className="font-medium text-primary hover:underline">View support preferences →</Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Your day</p><h3 className="mt-1 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>What&apos;s ahead</h3></div><button type="button" onClick={() => void load()} className="text-xs font-medium text-primary hover:underline">Refresh</button></div>
          {calendarStatus === "loading" ? <p className="mt-5 rounded-sm border border-border bg-bg/60 p-4 text-sm text-ink-mid">Loading the calendars you selected…</p> : calendarStatus === "error" ? <div className="mt-5 rounded-sm border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800">Beckett could not refresh your calendar right now. Your connection has not changed. <button type="button" onClick={() => void load()} className="font-medium underline">Try again</button></div> : calendar?.connected && !calendar.reauthorize ? (
            upcomingToday.length ? <div className="mt-5 space-y-3">{upcomingToday.slice(0, 5).map((event) => <article key={event.id} className="rounded-sm border border-border bg-bg/60 p-4"><p className="text-xs font-medium text-primary">{formatEventTime(event.start)}</p><p className="mt-1 text-sm font-medium text-ink">{event.title}</p>{hasOtherAttendees(event) && <Link href={prepHref(event)} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Prep for this meeting →</Link>}</article>)}</div> : <p className="mt-5 rounded-sm border border-border bg-bg/60 p-4 text-sm text-ink-mid">There is nothing else on your calendar today.</p>
          ) : <div className="mt-5 rounded-sm border border-primary/20 bg-primary-light/40 p-4 text-sm leading-relaxed text-ink-mid">Connect Google Calendar to see your day here and prepare for upcoming meetings. <Link href="/dashboard/apps" className="font-medium text-primary hover:underline">Connect calendar →</Link></div>}
          {updatedAt && <p className="mt-4 text-xs text-ink-light">Updated {formatEventTime(updatedAt.toISOString())}</p>}
        </div>

        <div className="space-y-5">
          <div ref={dayPlannerRef} />
          {savedOpenDayPlan && (
            <div className="rounded-card border border-primary/20 bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Today&apos;s focus</p>
              <p className="mt-1 text-lg text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{savedOpenDayPlan.focus}</p>
              {savedOpenDayPlan.nextStep ? <p className="mt-2 text-sm leading-relaxed text-ink-mid"><span className="font-medium text-ink">Next step:</span> {savedOpenDayPlan.nextStep}</p> : <p className="mt-2 text-sm leading-relaxed text-ink-mid">Keep this as your north star for today. Beckett has not added anything to your calendar.</p>}
              <button type="button" onClick={openPlanner} className="mt-3 text-xs font-medium text-primary hover:underline">Change focus →</button>
            </div>
          )}
          {!suggestionDismissed && <div className="rounded-card border border-primary/20 bg-primary-light/40 p-5 sm:p-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">{suggestion.kind === "prep_available" ? "A meeting on your calendar" : suggestion.kind === "next" ? "What’s ahead" : "A schedule-based suggestion"}</p><h3 className="mt-2 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{calendarStatus === "loading" ? "Checking what is ahead…" : calendar?.connected ? suggestion.title : "Start with what would help today."}</h3><p className="mt-2 text-sm leading-relaxed text-ink-mid">{calendarStatus === "loading" ? "Beckett is refreshing the calendars you selected." : calendar?.connected ? suggestion.detail : "Connect your calendar when you want Beckett to tailor this to your actual schedule."}</p>{openDayPlanner && <div className="mt-4 rounded-sm border border-primary/20 bg-white/80 p-4"><p className="text-sm font-medium text-ink">What would make today feel worthwhile?</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{["Make progress on work", "Take care of myself", "Get organized", "Prepare for something ahead", "I’m not sure yet"].map((choice) => <button key={choice} type="button" onClick={() => chooseOpenDayFocus(choice)} aria-pressed={openDayChoice === choice && !customOpenDayFocus} className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${openDayChoice === choice && !customOpenDayFocus ? "border-primary bg-primary-light" : "border-border bg-white hover:border-primary"}`}>{choice}</button>)}</div><label className="mt-3 block text-xs font-medium text-ink">Or write your own focus<input value={customOpenDayFocus} onChange={(event) => { setCustomOpenDayFocus(event.target.value); setOpenDayPlanStatus("idle"); }} placeholder="One thing that would make today feel better" className="mt-1 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" /></label><label className="mt-3 block text-xs font-medium text-ink">One next step (optional)<input value={openDayNextStep} onChange={(event) => { setOpenDayNextStep(event.target.value); setOpenDayPlanStatus("idle"); }} maxLength={300} placeholder="For example: open the project brief for 10 minutes" className="mt-1 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" /></label><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={openDayPlanStatus === "saving" || !(customOpenDayFocus.trim() || openDayChoice)} onClick={() => void saveOpenDayPlan()} className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">{openDayPlanStatus === "saving" ? "Saving…" : "Save today’s focus"}</button>{openDayPlanStatus === "error" && <span className="text-xs text-red-700">Could not save your focus. Please try again.</span>}{openDayPlanStatus === "saved" && <span className="text-xs text-primary">Saved for today.</span>}</div></div>}{holdPlanVisible && suggestion.suggestedHold && <div className="mt-4 rounded-sm border border-primary/20 bg-white/80 p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Proposed calendar hold</p><p className="mt-1 text-sm font-medium text-ink">{suggestion.suggestedHold.title} · {formatEventTime(suggestion.suggestedHold.start)}–{formatEventTime(suggestion.suggestedHold.end)}</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">This is only a suggestion. Beckett has not added anything to your calendar.</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><button type="button" onClick={() => void copySuggestedHold()} className="text-xs font-medium text-primary hover:underline">{holdCopied ? "Copied" : "Copy hold details"}</button><button type="button" disabled className="text-xs font-medium text-ink-light">Add to calendar — coming later</button></div><p className="mt-2 text-xs leading-relaxed text-ink-light">A future calendar write connection would require separate authorization and your final confirmation for this exact change.</p></div>}<div className="mt-5 flex flex-wrap gap-3">{(suggestion.kind === "prep" || suggestion.kind === "prep_available") && suggestion.event ? <Link href={prepHref(suggestion.event)} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark">{suggestion.kind === "prep" ? "Prepare now" : "Open meeting prep"}</Link> : suggestion.kind === "open" ? <button type="button" onClick={() => setOpenDayPlanner((value) => !value)} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark">{openDayPlanner ? "Close day planner" : "Plan your open day"}</button> : suggestion.kind === "next" ? <Link href="/dashboard/calendar" className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark">View your day</Link> : suggestion.suggestedHold ? <button type="button" onClick={() => setHoldPlanVisible((visible) => !visible)} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark">{holdPlanVisible ? "Hide proposed hold" : "Review proposed hold"}</button> : <Link href="/dashboard/workday" className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light">Plan a reset</Link>}<button type="button" onClick={() => setSuggestionDismissed(true)} className="rounded-pill border border-primary/30 bg-white px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light">Not today</button></div></div>}

          <div className="rounded-card border border-border bg-white"><button type="button" onClick={() => setSetupOpen((open) => !open)} aria-expanded={setupOpen} className="flex w-full items-center justify-between p-5 text-left"><span><span className="block text-xs font-medium uppercase tracking-wide text-ink-light">Set up your day</span><span className="mt-1 block text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{calendar?.connected ? "Choose support that fits what is ahead." : "Choose what would help today."}</span></span><span aria-hidden="true" className="text-xl text-primary">{setupOpen ? "−" : "+"}</span></button>{setupOpen && <div className="grid border-t border-border sm:grid-cols-3">{nextMeetingToPrep ? <><Link href={prepHref(nextMeetingToPrep)} className="border-b border-border p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">Prepare for {nextMeetingToPrep.title}</span><span className="mt-1 block text-xs font-normal text-ink-mid">Meeting with {attendeeNames(nextMeetingToPrep).slice(0, 2).join(", ")}.</span></Link><Link href={practiceHref(nextMeetingToPrep)} className="border-b border-border p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">Practice this conversation</span><span className="mt-1 block text-xs font-normal text-ink-mid">Rehearse a clear contribution or ask before you walk in.</span></Link></> : <button type="button" onClick={() => setOpenDayPlanner(true)} className="border-b border-border p-4 text-left text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">Plan your open day</span><span className="mt-1 block text-xs font-normal text-ink-mid">Choose progress, self-care, organization, preparation, or your own focus.</span></button>}<Link href="/dashboard/about#support-preferences" className="border-b border-border p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40 sm:border-b-0 sm:border-r"><span className="block text-primary">My support preferences</span><span className="mt-1 block text-xs font-normal text-ink-mid">Review the support you want Beckett to offer.</span></Link><Link href="/dashboard/calendar" className="p-4 text-sm font-medium text-ink transition-colors hover:bg-primary-light/40"><span className="block text-primary">View your week</span><span className="mt-1 block text-xs font-normal text-ink-mid">See the meetings and open space Beckett is using.</span></Link></div>}</div>
          {learningRecommendation && !learningPaused && <div className="rounded-card border border-primary/20 bg-white p-5"><p className="text-xs font-medium uppercase tracking-wide text-primary">A next step you can choose</p><h3 className="mt-1 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{learningRecommendation.title}</h3><p className="mt-2 text-sm leading-relaxed text-ink-mid">{learningRecommendation.reason}</p><button type="button" onClick={() => setLearningWhyOpen((open) => !open)} aria-expanded={learningWhyOpen} className="mt-3 text-xs font-medium text-primary hover:underline">{learningWhyOpen ? "Hide why Beckett suggested this" : "Why am I seeing this?"}</button>{learningWhyOpen && <div className="mt-2 rounded-sm border border-border bg-bg/60 p-3"><p className="text-xs leading-relaxed text-ink-mid">{learningRecommendation.why}</p><p className="mt-2 text-xs leading-relaxed text-ink-light">This uses only completed Practice, skills you completed, and a related preference or pattern you explicitly chose to save. It never uses Gmail, Calendar, or Slack content.</p></div>}<div className="mt-4 flex flex-wrap gap-3"><Link href={learningRecommendation.href} className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">{learningRecommendation.actionLabel}</Link>{learningRecommendation.secondaryHref && learningRecommendation.secondaryLabel && <Link href={learningRecommendation.secondaryHref} className="rounded-pill border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light">{learningRecommendation.secondaryLabel}</Link>}<button type="button" disabled={learningFeedbackStatus === "saving"} onClick={() => void recordLearningFeedback("save")} className="text-xs font-medium text-primary hover:underline disabled:opacity-60">Save for later</button><button type="button" disabled={learningFeedbackStatus === "saving"} onClick={() => void recordLearningFeedback("dismiss")} className="text-xs font-medium text-ink-mid hover:underline disabled:opacity-60">Not relevant</button><button type="button" disabled={learningFeedbackStatus === "saving"} onClick={() => void pauseLearningRecommendations()} className="text-xs font-medium text-ink-light hover:underline disabled:opacity-60">Pause recommendations</button></div>{learningFeedbackError && <p className="mt-3 text-xs text-red-700">{learningFeedbackError}</p>}</div>}
        </div>
      </div>
    </section>
  );
}
