# Google OAuth verification package

## Current production configuration

- Production Google Cloud project: `strange-vortex-496820-t3` (project number `409706780405`)
- Production OAuth client: **Beckett Web**
- Client ID: `409706780405-r2mso24tcbmq1no3b2elfrc4vha3s9u6.apps.googleusercontent.com`
- Requested scopes:
  - `openid`, `email`, `profile`
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
  - `https://www.googleapis.com/auth/calendar.events.readonly`

The production client has the following callbacks:
- `https://www.meetbeckett.co/api/calendar/oauth/callback`
- `https://meetbeckett.co/api/calendar/oauth/callback`

## Scope justification (saved in Google Cloud)

### Calendar: `calendar.calendarlist.readonly` and `calendar.events.readonly`

Beckett uses Google Calendar only after a user connects it and selects calendars. `calendar.calendarlist.readonly` is needed to display the user’s subscribed calendars so they can choose which calendars Beckett may use. `calendar.events.readonly` is then used only for events in those selected calendars to show a week view, identify upcoming meetings with other attendees, provide optional meeting preparation, and offer day-planning suggestions. Beckett reads only event title, start/end time, and attendee names; it does not create, edit, cancel, respond to, or store calendar events. `calendar.freebusy` is insufficient because it does not provide titles or attendees; `calendar.events.owned.readonly` is insufficient because it excludes meetings the user attends but does not own. No write Calendar scope is requested.

## Reviewer instructions

**Test URL:** `https://www.meetbeckett.co/auth/login`

**Beckett reviewer account:** `hello+test1@meetbeckett.co`

**Password:** supplied separately to Google; do not include it in this document or the demo video.

1. Sign in with the reviewer account using email and password.
2. Open **Apps** and select **Connect** for Google Calendar.
3. Complete Google OAuth. The consent screen requests only the two read-only Calendar scopes listed above.
4. Return to Beckett and choose which calendars it may use.
5. Open **Calendar & Meetings** to see selected-calendar events in the week view and meeting preparation for events with other attendees.
6. Return to **Apps** to disconnect Google Calendar. Beckett does not create, edit, cancel, or respond to calendar events.

Gmail coaching is reviewed separately as a Google Workspace add-on. It uses only add-on-specific contextual scopes and is not part of the Beckett Web OAuth client.

## Video checklist

Record in English with the entire browser window visible. Show the full consent flow—not only the final app screen.

1. Start signed out at `https://www.meetbeckett.co`, then show the Privacy Policy link.
2. Sign in to the reviewer account.
3. Show Apps → Google Calendar.
4. Click Connect, show consent with `calendar.calendarlist.readonly` and `calendar.events.readonly`, allow it, and show the calendar-selection screen.
5. Show Calendar & Meetings week view and an attendee-bearing event’s meeting-preparation experience.
6. Show the Google Calendar disconnect control.
7. Ensure the video shows only the production **Beckett Web** OAuth client’s Calendar consent flow.

## Response email template

Subject: Updated OAuth verification materials — Beckett

Hello Google Third-Party Data Safety Team,

Thank you for the review guidance. We have updated our production OAuth implementation and verification materials.

- Beckett Web requests only identity and read-only Google Calendar scopes.
- Mailbox-wide `gmail.readonly` access and the standalone Gmail OAuth callback have been removed from the website and Chrome extension.
- Gmail coaching is provided only by the Google Workspace add-on using contextual scopes for conversations the user explicitly analyzes.
- The exact active Beckett Web scopes are: `openid`, `email`, `profile`, `calendar.calendarlist.readonly`, and `calendar.events.readonly`.
- We updated the scope justifications and reviewer flow to cover the current Calendar-only web connection.

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
