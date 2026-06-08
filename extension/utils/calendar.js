export async function fetchUpcomingEvents(token) {
  const now = new Date();
  const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
    new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    }),
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.items || []).filter(e => e.start?.dateTime); // skip all-day events
}

export function getAttendeesFromEvent(event) {
  return (event.attendees || [])
    .filter(a => !a.self && a.email)
    .map(a => a.email);
}

export function getMinsUntilEvent(event) {
  const start = new Date(event.start.dateTime);
  return Math.round((start - Date.now()) / 60000);
}
