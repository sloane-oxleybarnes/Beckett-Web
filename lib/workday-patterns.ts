export const timeOfDayValues = ["morning", "midday", "afternoon", "evening"] as const;
export const workloadValues = ["light", "steady", "stacked"] as const;
export const breakStatusValues = ["taken", "not_taken", "would_help"] as const;
export const helpfulStrategyValues = [
  "quiet_block",
  "written_next_steps",
  "clearer_priority",
  "short_break",
  "draft_before_sending",
  "none_yet",
] as const;
export const supportActionValues = [
  "short_walk",
  "food_or_water",
  "quiet_minutes",
  "smaller_next_step",
  "plan_priority",
  "prepare_next",
  "ask_for_time",
] as const;

export type WorkdayCheckin = {
  id?: string;
  time_of_day: (typeof timeOfDayValues)[number];
  workload_level: (typeof workloadValues)[number];
  energy_level: number;
  communication_friction: boolean;
  break_status: (typeof breakStatusValues)[number];
  helpful_strategy: (typeof helpfulStrategyValues)[number];
  checked_in_at?: string;
  calendar_context?: CalendarContext;
};

export type CalendarContext = {
  connected: boolean;
  event_count: number;
  meeting_count: number;
  meeting_heavy: boolean;
  no_lunch_opening: boolean;
};

export type SupportActionRecord = {
  action_type: (typeof supportActionValues)[number];
  outcome: "helped" | "a_little" | "not_helpful" | "skipped" | null;
  remember_for_learning?: boolean;
};

export type PatternSummary = {
  category: "load" | "friction" | "break" | "strategy";
  pattern_key: string;
  summary: string;
  evidence: { matchingCheckins: number; totalCheckins: number; periodDays: number; timeOfDay?: WorkdayCheckin["time_of_day"] };
};

export function timeOfDayForDate(date = new Date()): WorkdayCheckin["time_of_day"] {
  const hour = date.getHours();
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  return "evening";
}

const actionLabels: Record<SupportActionRecord["action_type"], string> = {
  short_walk: "a short walk",
  food_or_water: "food, water, or coffee",
  quiet_minutes: "five quiet minutes",
  smaller_next_step: "a smaller next step",
  plan_priority: "choosing one priority",
  prepare_next: "preparing for what was next",
  ask_for_time: "asking for more time",
};

export function makePatternSummaries(checkins: WorkdayCheckin[], actions: SupportActionRecord[] = []): PatternSummary[] {
  if (checkins.length < 3) return [];
  const totalCheckins = checkins.length;
  const evidence = (matchingCheckins: number) => ({ matchingCheckins, totalCheckins, periodDays: 14 });
  const summaries: PatternSummary[] = [];

  const meetingHeavyAfternoon = checkins.filter((checkin) =>
    checkin.time_of_day === "afternoon" &&
    (checkin.energy_level <= 2 || checkin.workload_level === "stacked") &&
    checkin.calendar_context?.meeting_heavy
  ).length;
  if (meetingHeavyAfternoon >= 3) summaries.push({
    category: "load",
    pattern_key: "afternoon-meeting-heavy-reset",
    summary: `You have selected low energy or overload in the afternoon after meeting-heavy days ${meetingHeavyAfternoon} times recently. Would you like Beckett to offer a reset before that stretch?`,
    evidence: { ...evidence(meetingHeavyAfternoon), timeOfDay: "afternoon" },
  });

  const noLunchLaterLowEnergy = checkins.filter((checkin) =>
    (checkin.time_of_day === "afternoon" || checkin.time_of_day === "evening") &&
    checkin.energy_level <= 2 &&
    checkin.calendar_context?.no_lunch_opening
  ).length;
  if (noLunchLaterLowEnergy >= 3) summaries.push({
    category: "break",
    pattern_key: "lunch-opening-and-later-energy",
    summary: `On days without a lunch-sized opening, you have selected low energy later in the day ${noLunchLaterLowEnergy} times. Would you like Beckett to look for a lunch-sized opening?`,
    evidence: evidence(noLunchLaterLowEnergy),
  });

  const rememberedHelpfulActions = actions.filter((action) =>
    action.remember_for_learning &&
    (action.outcome === "helped" || action.outcome === "a_little")
  );
  const actionCounts = new Map<SupportActionRecord["action_type"], number>();
  rememberedHelpfulActions.forEach((action) => actionCounts.set(action.action_type, (actionCounts.get(action.action_type) || 0) + 1));
  const repeatedAction = Array.from(actionCounts.entries()).find(([, count]) => count >= 2);
  if (repeatedAction) {
    const [action, count] = repeatedAction;
    summaries.push({
      category: "strategy",
      pattern_key: `remembered-support-${action}`,
      summary: `You chose to remember that ${actionLabels[action]} helped at least a little ${count} times. Would you like Beckett to keep offering it when a similar check-in comes up?`,
      evidence: evidence(count),
    });
  }

  return summaries;
}
