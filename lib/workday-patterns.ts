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

const labels: Record<WorkdayCheckin["helpful_strategy"], string> = {
  quiet_block: "a quieter block of time",
  written_next_steps: "written next steps",
  clearer_priority: "a clearer priority",
  short_break: "a short break",
  draft_before_sending: "drafting before sending",
  none_yet: "no strategy yet",
};

export function makePatternSummaries(checkins: WorkdayCheckin[]): PatternSummary[] {
  if (checkins.length < 3) return [];
  const totalCheckins = checkins.length;
  const evidence = (matchingCheckins: number) => ({ matchingCheckins, totalCheckins, periodDays: 14 });
  const summaries: PatternSummary[] = [];

  const stacked = checkins.filter((checkin) => checkin.workload_level === "stacked").length;
  if (stacked >= 3) summaries.push({
    category: "load",
    pattern_key: "stacked-workload",
    summary: `You reported a stacked workload in ${stacked} of your last ${totalCheckins} check-ins.`,
    evidence: evidence(stacked),
  });

  const friction = checkins.filter((checkin) => checkin.communication_friction).length;
  if (friction >= 3) summaries.push({
    category: "friction",
    pattern_key: "communication-friction",
    summary: `You marked communication friction in ${friction} of your last ${totalCheckins} check-ins.`,
    evidence: evidence(friction),
  });

  const breakNeed = checkins.filter((checkin) => checkin.break_status === "would_help").length;
  if (breakNeed >= 3) summaries.push({
    category: "break",
    pattern_key: "break-would-help",
    summary: `You said a break would help in ${breakNeed} of your last ${totalCheckins} check-ins.`,
    evidence: evidence(breakNeed),
  });

  for (const strategy of helpfulStrategyValues.filter((value) => value !== "none_yet")) {
    const used = checkins.filter((checkin) => checkin.helpful_strategy === strategy).length;
    if (used >= 3) {
      summaries.push({
        category: "strategy",
        pattern_key: `strategy-${strategy}`,
        summary: `You chose ${labels[strategy]} in ${used} of your last ${totalCheckins} check-ins.`,
        evidence: evidence(used),
      });
      break;
    }
  }

  for (const timeOfDay of timeOfDayValues) {
    const lowerCapacity = checkins.filter((checkin) => checkin.time_of_day === timeOfDay && (checkin.energy_level <= 2 || checkin.workload_level === "stacked")).length;
    if (lowerCapacity >= 3) {
      summaries.push({
        category: "load",
        pattern_key: `lower-capacity-${timeOfDay}`,
        summary: `In the ${timeOfDay}, you marked lower energy or a stacked workload in ${lowerCapacity} check-ins.`,
        evidence: { ...evidence(lowerCapacity), timeOfDay },
      });
    }
  }

  return summaries;
}
