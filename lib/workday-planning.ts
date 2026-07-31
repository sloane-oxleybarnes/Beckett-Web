export const reminderKinds = ["check_in", "reset", "review_plan"] as const;

export type ReminderKind = (typeof reminderKinds)[number];

export const reminderKindCopy: Record<ReminderKind, { label: string; detail: string; nudge: string; href: string; action: string }> = {
  check_in: {
    label: "Check in with myself",
    detail: "Open the private daily check-in.",
    nudge: "Take a private moment to check in. You can dismiss this without recording anything.",
    href: "#today-checkin",
    action: "Open check-in ↓",
  },
  reset: {
    label: "Choose a short reset",
    detail: "Open a low-pressure support choice when the day feels harder.",
    nudge: "Take a private moment to choose a small reset, or dismiss this with no record.",
    href: "#today-checkin",
    action: "Choose a reset ↓",
  },
  review_plan: {
    label: "Review my support preferences",
    detail: "Revisit the support preferences you have already chosen.",
    nudge: "Review the support preferences you have chosen for yourself, or dismiss this for today.",
    href: "/dashboard/about#support-preferences",
    action: "Review preferences →",
  },
};

export function isReminderKind(value: unknown): value is ReminderKind {
  return typeof value === "string" && reminderKinds.includes(value as ReminderKind);
}

export function isValidReminderTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function isValidPlanDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function workdayPlanDate(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}
