import assert from "node:assert/strict";
import test from "node:test";
import {
  findConsecutiveMeetingStretch,
  getDaySuggestion,
  hasLunchOpening,
} from "../lib/calendar-insights.ts";

const day = "2026-08-24";
const attendee = [{ name: "A teammate", email: "teammate@example.com" }];

function event(id, start, end, { attendees = attendee, title = `Meeting ${id}` } = {}) {
  return {
    id,
    title,
    start: `${day}T${start}:00-07:00`,
    end: end ? `${day}T${end}:00-07:00` : null,
    attendees,
  };
}

test("two back-to-back meetings do not produce an automatic break recommendation", () => {
  const events = [event("one", "09:00", "09:30"), event("two", "09:30", "10:00")];
  const suggestion = getDaySuggestion(events, new Date(`${day}T08:00:00-07:00`));

  assert.notEqual(suggestion.kind, "break");
  assert.equal(findConsecutiveMeetingStretch(events), null);
});

test("three consecutive meetings produce one reset recommendation after the stretch", () => {
  const events = [
    event("one", "09:00", "09:30"),
    event("two", "09:35", "10:05"),
    event("three", "10:15", "10:45"),
  ];
  const suggestion = getDaySuggestion(events, new Date(`${day}T08:00:00-07:00`));

  assert.equal(suggestion.kind, "break");
  assert.match(suggestion.title, /3 meetings in a row/);
  assert.match(suggestion.detail, /after it rather than between meetings/);
});

test("a longer sequence is reported as one complete meeting stretch", () => {
  const events = [
    event("one", "09:00", "09:30"),
    event("two", "09:30", "10:00"),
    event("three", "10:00", "10:30"),
    event("four", "10:30", "11:00"),
  ];
  const stretch = findConsecutiveMeetingStretch(events);

  assert.equal(stretch?.events.length, 4);
  assert.equal(getDaySuggestion(events, new Date(`${day}T08:00:00-07:00`)).title, "You have 4 meetings in a row.");
});

test("a gap over 15 minutes breaks the meeting sequence", () => {
  const events = [
    event("one", "09:00", "09:30"),
    event("two", "09:30", "10:00"),
    event("three", "10:16", "10:46"),
  ];

  assert.equal(findConsecutiveMeetingStretch(events), null);
  assert.notEqual(getDaySuggestion(events, new Date(`${day}T08:00:00-07:00`)).kind, "break");
});

test("calendar items without attendees do not count as meetings", () => {
  const events = [
    event("one", "09:00", "09:30", { attendees: [] }),
    event("two", "09:30", "10:00", { attendees: [] }),
    event("three", "10:00", "10:30", { attendees: [] }),
  ];

  assert.equal(findConsecutiveMeetingStretch(events), null);
  assert.notEqual(getDaySuggestion(events, new Date(`${day}T08:00:00-07:00`)).kind, "break");
});

test("one long meeting does not produce an automatic break recommendation", () => {
  const events = [event("long", "09:00", "11:00")];

  assert.notEqual(getDaySuggestion(events, new Date(`${day}T08:00:00-07:00`)).kind, "break");
});

test("the afternoon scenario describes the real open time instead of a stale lunch warning", () => {
  const events = [
    event("consultation", "15:15", "15:45", { attendees: [], title: "Consultation with Dr. Christina Daly" }),
    event("broker", "16:30", "17:00", { attendees: [], title: "Talk with Stephen the broker" }),
  ];
  const suggestion = getDaySuggestion(events, new Date(`${day}T14:11:00-07:00`));

  assert.equal(suggestion.kind, "next");
  assert.equal(suggestion.title, "You have open time before Consultation with Dr. Christina Daly.");
  assert.doesNotMatch(`${suggestion.title} ${suggestion.detail}`, /lunch|packed/i);
});

test("lunch availability checks the full midday schedule, not only time remaining", () => {
  const openLunch = [event("one", "12:00", "12:30")];
  const blockedLunch = [event("one", "11:30", "12:30"), event("two", "12:30", "13:30"), event("three", "13:30", "14:30")];
  const date = new Date(`${day}T14:11:00-07:00`);

  assert.equal(hasLunchOpening(openLunch, date), true);
  assert.equal(hasLunchOpening(blockedLunch, date), false);
});
