import { formatEventTime } from "@/lib/calendar-insights";

/**
 * A user-reviewed proposal for a future calendar change.
 *
 * This deliberately does not call Google Calendar or persist an event. Beckett's
 * current Calendar connection is read-only; this type keeps the future approval
 * boundary explicit without changing the OAuth request now under review.
 */
export type CalendarActionIntent = {
  kind: "create_hold";
  title: string;
  start: string;
  end: string;
  source: "home_schedule_suggestion";
};

export function formatCalendarActionIntent(intent: CalendarActionIntent) {
  return `${intent.title}: ${formatEventTime(intent.start)}–${formatEventTime(intent.end)}`;
}
