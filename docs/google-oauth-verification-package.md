# Google OAuth verification package

## Current production configuration

- Production Google Cloud project: `strange-vortex-496820-t3` (project number `409706780405`)
- Production OAuth client: **Beckett Web**
- Requested scopes:
  - `openid`, `email`, `profile`
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
  - `https://www.googleapis.com/auth/calendar.events.readonly`
  - `https://www.googleapis.com/auth/gmail.readonly`

The production client has the following callbacks:

- `https://www.meetbeckett.co/api/gmail/oauth/callback`
- `https://meetbeckett.co/api/gmail/oauth/callback`
- `https://www.meetbeckett.co/api/calendar/oauth/callback`
- `https://meetbeckett.co/api/calendar/oauth/callback`

## Scope justification (saved in Google Cloud)

### Gmail: `gmail.readonly`

Beckett is a web app with a Chrome extension. After a user opts in to Gmail and asks Beckett for help on a specific Gmail thread, the extension sends that user-invoked thread identifier to Beckett’s backend. The backend uses `gmail.readonly` to retrieve that thread’s full message bodies and relevant headers, then returns an optional summary, coaching guidance, or draft reply for the user to review and send themselves. Beckett cannot send, modify, delete, archive, or label Gmail data. `gmail.metadata` is insufficient because it excludes message bodies; a Gmail Add-on scope would require Beckett to be a Google Workspace Gmail Add-on, which it is not. Beckett does not browse the mailbox or retrieve other threads; access is optional, disconnectable, and used only for the user-requested coaching feature.

### Calendar: `calendar.calendarlist.readonly` and `calendar.events.readonly`

Beckett uses Google Calendar only after a user connects it and selects calendars. `calendar.calendarlist.readonly` is needed to display the user’s subscribed calendars so they can choose which calendars Beckett may use. `calendar.events.readonly` is then used only for events in those selected calendars to show a week view, identify upcoming meetings with other attendees, provide optional meeting preparation, and offer day-planning suggestions. Beckett reads only event title, start/end time, and attendee names; it does not create, edit, cancel, respond to, or store calendar events. `calendar.freebusy` is insufficient because it does not provide titles or attendees; `calendar.events.owned.readonly` is insufficient because it excludes meetings the user attends but does not own. No write Calendar scope is requested.

## Reviewer instructions

**Test URL:** `https://www.meetbeckett.co/auth/login`

**Beckett reviewer account:** `hello+test1@meetbeckett.co`

**Password:** supplied separately to Google; do not include it in this document or the demo video.

1. Sign in with the reviewer account using email and password.
2. Open **Settings** and scroll to **Connected accounts**.
3. Select **Connect** next to Google (Gmail).
4. Complete Google OAuth with a Gmail account controlled by the reviewer. The consent screen requests only read-only Gmail access.
5. Confirm Beckett returns to Settings and displays the connected Gmail address. The Beckett session must remain signed in as `hello+test1@meetbeckett.co`.
6. Open a Gmail conversation and use the Beckett Chrome extension’s companion to request Decode. Beckett returns optional explanation and drafting support for the user-selected thread; it does not send or modify email.
7. For Calendar, select **Reconnect** next to Google Calendar, choose calendars, and complete OAuth. Open **Calendar & Meetings** to see selected-calendar events in the week view and meeting preparation for events with other attendees.
8. Return to Settings to disconnect either integration. Beckett does not create, edit, cancel, or respond to calendar events; it does not send email.

## Video checklist

Record in English with the entire browser window visible. Show the full consent flow—not only the final app screen.

1. Start signed out at `https://www.meetbeckett.co`, then show the Privacy Policy link.
2. Sign in to the reviewer account.
3. Show Settings → Connected accounts.
4. Gmail: click Connect, show account selection, show consent with `gmail.readonly`, allow it, then show the returned connected state.
5. Gmail: open a harmless test thread and invoke Decode in the Beckett extension; show the resulting user-facing support.
6. Calendar: click Reconnect, select calendars, show consent with `calendar.calendarlist.readonly` and `calendar.events.readonly`, allow it, and show the calendar-selection screen.
7. Calendar: show Calendar & Meetings week view and an attendee-bearing event’s meeting-preparation experience.
8. Show disconnect controls for Gmail and Calendar.
9. Ensure the video shows only the single production **Beckett Web** OAuth client’s consent flow.

## Response email template

Subject: Updated OAuth verification materials — Beckett

Hello Google Third-Party Data Safety Team,

Thank you for the review guidance. We have updated our production OAuth implementation and verification materials.

- We now use one production web OAuth client, Beckett Web, for the web application’s Gmail and Calendar connections.
- The Chrome extension no longer has an independent Google OAuth client or Google OAuth scope. It uses the user’s existing, opt-in Beckett web integration for a user-invoked Gmail thread.
- The exact active production scopes are: `openid`, `email`, `profile`, `calendar.calendarlist.readonly`, `calendar.events.readonly`, and `gmail.readonly`.
- We updated the scope justifications in Google Cloud to describe the maximum user-facing behavior, backend use, and why narrower scopes are insufficient.
- We verified the Gmail flow end-to-end: the user connects Gmail from Beckett Settings, sees only the read-only Gmail consent flow, remains signed into the same Beckett account after return, and can invoke Decode on a selected Gmail thread through the extension.

Demo video: [INSERT YOUTUBE URL]

Test credentials:

- URL: `https://www.meetbeckett.co/auth/login`
- Email: `hello+test1@meetbeckett.co`
- Password: [INSERT SEPARATELY]

Step-by-step reviewer instructions are included below:

[PASTE REVIEWER INSTRUCTIONS ABOVE]

Please let us know if you need any additional materials.

Best,

Sloane Oxley-Barnes
Beckett
