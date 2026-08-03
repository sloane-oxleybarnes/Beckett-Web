import { attendeeNames, type CalendarEvent } from "@/lib/calendar-insights";

export type MeetingPrepContact = {
  name: string;
  email?: string | null;
  relationship_tags?: string[] | null;
  primary_relationship_tag?: string | null;
  notes?: string | null;
  trusted?: boolean | null;
};

export function contactsForMeeting(event: CalendarEvent, contacts: MeetingPrepContact[]) {
  const attendeeLabels = attendeeNames(event).map((value) => value.trim().toLowerCase());
  return contacts.filter((contact) => {
    const name = contact.name.trim().toLowerCase();
    const email = contact.email?.trim().toLowerCase();
    return attendeeLabels.includes(name) || Boolean(email && attendeeLabels.includes(email));
  });
}

// A name alone is not enough to make an unsolicited recommendation. Beckett waits
// until the user has intentionally saved relationship context it can actually use.
export function hasMeaningfulMeetingContext(contact: MeetingPrepContact) {
  return Boolean(contact.relationship_tags?.length || contact.notes?.trim() || contact.trusted);
}

export function hasEarnedMeetingPrepSignal(event: CalendarEvent, contacts: MeetingPrepContact[]) {
  return contactsForMeeting(event, contacts).some(hasMeaningfulMeetingContext);
}
