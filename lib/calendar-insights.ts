export type CalendarAttendee = {
  name: string | null;
  email: string | null;
  responseStatus?: string | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  attendees: CalendarAttendee[];
};

export function hasOtherAttendees(event: Pick<CalendarEvent, "attendees">) {
  return event.attendees.length > 0;
}

export function eventsOnDay(events: CalendarEvent[], date: Date) {
  return events.filter((event) => new Date(event.start).toDateString() === date.toDateString());
}

export function formatEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function attendeeNames(event: Pick<CalendarEvent, "attendees">) {
  return event.attendees
    .map((attendee) => attendee.name || attendee.email)
    .filter((value): value is string => Boolean(value));
}

export type DaySuggestion = {
  title: string;
  detail: string;
  kind: "break" | "prep" | "prep_available" | "next" | "open";
  event?: CalendarEvent;
  suggestedHold?: {
    title: string;
    start: string;
    end: string;
  };
};

export function hasLunchOpening(events: CalendarEvent[], day: Date) {
  const timedEvents = events
    .filter((event) => event.end)
    .map((event) => ({ start: new Date(event.start), end: new Date(event.end as string) }))
    .sort((left, right) => left.start.getTime() - right.start.getTime());
  const referenceEvent = events.find((event) => event.end);
  const referenceMatch = referenceEvent?.start.match(/^(\d{4}-\d{2}-\d{2})T.*(Z|[+-]\d{2}:\d{2})$/);
  const lunchDate = referenceMatch?.[1] || `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const lunchOffset = referenceMatch?.[2] || "";
  const lunchStart = referenceMatch
    ? new Date(`${lunchDate}T11:30:00${lunchOffset}`)
    : new Date(day);
  const lunchEnd = referenceMatch
    ? new Date(`${lunchDate}T14:30:00${lunchOffset}`)
    : new Date(day);
  if (!referenceMatch) {
    lunchStart.setHours(11, 30, 0, 0);
    lunchEnd.setHours(14, 30, 0, 0);
  }
  let openingStart = lunchStart;

  for (const event of timedEvents) {
    if (event.end <= lunchStart || event.start >= lunchEnd) continue;
    const openingEnd = event.start < lunchEnd ? event.start : lunchEnd;
    if (openingEnd.getTime() - openingStart.getTime() >= 30 * 60_000) return true;
    if (event.end > openingStart) openingStart = event.end;
  }

  return lunchEnd.getTime() - openingStart.getTime() >= 30 * 60_000;
}

export type ConsecutiveMeetingStretch = {
  events: CalendarEvent[];
  start: Date;
  end: Date;
};

export function findConsecutiveMeetingStretch(events: CalendarEvent[], now?: Date): ConsecutiveMeetingStretch | null {
  const meetings = events
    .filter((event) => hasOtherAttendees(event) && event.end)
    .filter((event) => !now || new Date(event.end as string).getTime() > now.getTime())
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
  let stretch: CalendarEvent[] = [];

  for (const meeting of meetings) {
    const previous = stretch.at(-1);
    const gap = previous?.end
      ? new Date(meeting.start).getTime() - new Date(previous.end).getTime()
      : Number.POSITIVE_INFINITY;
    if (previous && gap <= 15 * 60_000) {
      stretch = [...stretch, meeting];
      continue;
    }
    if (stretch.length >= 3) {
      return {
        events: stretch,
        start: new Date(stretch[0].start),
        end: new Date(stretch.at(-1)?.end as string),
      };
    }
    stretch = [meeting];
  }

  if (stretch.length >= 3) {
    return {
      events: stretch,
      start: new Date(stretch[0].start),
      end: new Date(stretch.at(-1)?.end as string),
    };
  }

  return null;
}

export function getDaySuggestion(events: CalendarEvent[], now = new Date(), options?: { recommendPrep?: boolean }): DaySuggestion {
  const today = eventsOnDay(events, now).sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
  const upcoming = today.filter((event) => new Date(event.start).getTime() >= now.getTime());
  const nextMeeting = upcoming.find(hasOtherAttendees);
  const soonMeeting = upcoming.find((event) => hasOtherAttendees(event) && new Date(event.start).getTime() - now.getTime() <= 2 * 60 * 60_000);
  const meetingStretch = findConsecutiveMeetingStretch(today, now);

  if (!today.length) {
    return {
      title: "Your calendar is open today.",
      detail: "Choose one useful focus or a restorative activity that will make the day feel good.",
      kind: "open",
    };
  }

  if (meetingStretch) {
    return {
      title: `You have ${meetingStretch.events.length} meetings in a row.`,
      detail: `The stretch ends around ${formatEventTime(meetingStretch.end.toISOString())}. If it would help, plan one brief reset after it rather than between meetings.`,
      kind: "break",
    };
  }

  if (soonMeeting) {
    if (options?.recommendPrep === false) {
      return {
        title: `${soonMeeting.title} is coming up.`,
        detail: `You can open private meeting prep for your conversation with ${attendeeNames(soonMeeting).slice(0, 2).join(" and ") || "another person"} whenever it would be useful.`,
        kind: "prep_available",
        event: soonMeeting,
      };
    }
    return {
      title: `Prepare for ${soonMeeting.title}.`,
      detail: `You are meeting with ${attendeeNames(soonMeeting).slice(0, 2).join(" and ") || "another person"} soon. A few minutes on your outcome could reduce pressure.`,
      kind: "prep",
      event: soonMeeting,
    };
  }

  if (nextMeeting) {
    if (options?.recommendPrep === false) {
      return {
        title: `${nextMeeting.title} is next on your calendar.`,
        detail: "Meeting prep is available when you want it. Beckett will start making proactive prep suggestions only after you save relevant context or preferences.",
        kind: "prep_available",
        event: nextMeeting,
      };
    }
    return {
      title: `Prepare for ${nextMeeting.title}.`,
      detail: `You are meeting with ${attendeeNames(nextMeeting).slice(0, 2).join(" and ") || "another person"}. A few minutes on your outcome could reduce pressure.`,
      kind: "prep",
      event: nextMeeting,
    };
  }

  const nextEvent = upcoming[0];
  if (nextEvent) {
    return {
      title: `You have open time before ${nextEvent.title}.`,
      detail: `Your next scheduled item starts at ${formatEventTime(nextEvent.start)}. The time before it is open on your calendar.`,
      kind: "next",
      event: nextEvent,
    };
  }

  return {
    title: "The rest of your calendar is open today.",
    detail: "There are no more scheduled items on the calendars you selected.",
    kind: "open",
  };
}
