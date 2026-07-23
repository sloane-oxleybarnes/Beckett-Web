# Beckett shared-system contract

**Status:** Active for staging  
**Version:** 1.0  
**Owner:** Beckett product and engineering  
**Last reviewed:** July 23, 2026  
**Next review:** October 21, 2026 (every 90 days, and before any new surface or high-risk integration ships)

## Purpose

Beckett is one coaching system delivered through more than one surface. This contract defines the data, consent, safety, and retention rules that every surface must follow so a user's preferences and protections do not drift.

It is a build requirement, not merely a design principle. A new surface may not create its own authoritative profile, coaching settings, safety routing, integration state, or retention policy.

## Scope and frozen work

The contract applies to:

- The Beckett web app.
- The Beckett Chrome extension when its frozen work resumes.
- The future desktop companion when its frozen work resumes.

Slack is an integration with additional workspace rules. Its current implementation is frozen for the Slackathon and is not changed by this contract work. The desktop simulator/adaptive-conversation work is also frozen. Neither is a source of new shared-system behavior until its respective freeze ends.

## Authoritative system

Supabase and Beckett's authenticated server APIs are the authoritative shared system. The web app, extension, and desktop companion may cache only the minimum data needed for a current interaction; they must refresh from the shared system and must not treat a local cache as final.

No browser extension storage, desktop local database, Slack record, or third-party integration may become a competing source of truth for the fields below.

## Shared data contract

| Domain | Authoritative record | Shared rule |
| --- | --- | --- |
| Account and profile | `profiles` | Name, account/plan state, onboarding, and account deletion state follow the user everywhere. |
| Coaching settings | `profiles` | Communication preferences, coaching tone, proactive-coaching preference, pattern-model choice, and workday preferences apply everywhere unless the user makes a more specific choice at a sensitive moment. |
| Contacts and tags | Contacts records and tags | A contact or tag created, edited, merged, or deleted in one Beckett surface must resolve to the same person and context in all other surfaces. |
| Safety-resource region | `profiles.safety_resource_region` | Beckett does not infer location. It uses only the country/region explicitly selected by the user. The reviewed U.S.-first set remains the fallback until a reviewed local set exists. |
| Safety resources | `lib/safety-resources.ts` and its reviewed links | All AI and coaching routes use the shared safety router. Resource owner, review date, next review date, and review cadence are visible. |
| Workday check-ins and patterns | Workday records and settings | Check-ins are voluntary. Pattern support and reminders honor the user's saved controls; no surface may generate a check-in automatically. |
| Connected integrations | `user_integrations` and authenticated APIs | Connection state is shared. OAuth credentials stay server-side and are encrypted at rest. Disconnecting removes the local connection record and stops every surface from using it. |
| Calendar context | Google Calendar integration and `/api/calendar/*` | Only selected calendars, event title, timing, and attendee context may be used for the approved planning and meeting-preparation features. Calendar events are not stored as an archive. |

## Consent model

Consent is layered. A broad preference does not authorize a higher-risk action.

1. **General product settings** — Coaching tone, communication preferences, reminders, pattern support, and safety-resource region are saved choices that follow the user.
2. **Connected-service consent** — Gmail and Calendar require their own OAuth consent. Calendar remains read-only during beta and only selected calendars are used.
3. **Moment-specific consent** — The user must approve each higher-impact action at the time it happens. Examples include enabling notifications, creating or changing a calendar event in a future release, beginning live meeting support, retaining meeting notes, or capturing transcript/audio.
4. **Surface-specific confirmation** — A new surface must explain its access before it uses a connected service or device capability for the first time. It cannot rely on a vague prior consent.

No surface may turn on a notification, begin recording, retain transcript/audio, share data with Slack, or write to a calendar silently.

## Retention and deletion rules

- Profile, preference, contact, and voluntary workday data remain only as long as needed to provide the user-selected feature, until the user changes/deletes it or requests account deletion.
- Gmail and Slack raw message history are not stored by default. Calendar events are read in real time and are not stored as an event archive.
- Google connection credentials are encrypted at rest, available only to server-side code that provides the feature, and removed when the user disconnects Google or deletes their account.
- A new data type may not be retained without documenting: purpose, storage location, retention rule, deletion path, and whether an additional consent is required.
- During beta, account deletion is handled manually across Beckett and connected operating systems, with a target completion window of 30 days.
- Live meeting notes, transcripts, and audio have no default cross-surface retention permission. Any future implementation needs a separate approved design and explicit user setting before storage begins.

## Safety routing

Every coaching surface must call the shared safety router before generating normal coaching for crisis, relationship-safety, health, or legal-risk content.

- The response must use the saved safety-resource region.
- If a reviewed local resource set is unavailable, the interface must say so and identify the reviewed U.S.-first fallback rather than imply local accuracy.
- Safety routing must not be bypassed by a client-side implementation, prompt-only check, cached response, extension feature, or desktop feature.
- Beckett does not provide crisis intervention, medical advice, legal advice, or abuse safety planning.

## Calendar-aware planning rules

- Use only calendars selected by the user.
- Show a meeting-preparation action only when the event has another attendee.
- Use schedule context to offer suggestions, not to make automatic changes.
- Calendar suggestions are advisory and dismissible. Calendar writes require a new, explicit confirmation at the exact proposed change.
- Disconnecting Calendar immediately removes calendar context from Overview, Calendar & Meetings, extension, and future desktop surfaces.

## Required implementation patterns

- Authenticate and obtain the user server-side before reading or mutating shared data.
- Enforce ownership with Supabase RLS and user-scoped queries; never use client-editable metadata for authorization.
- Prefer the shared authenticated APIs for extension and desktop access. Do not expose service-role keys, OAuth credentials, raw calendar events, or other users' data to a client.
- When a setting changes, update the canonical record first, then refresh local state.
- Add a contract review to every new integration, surface, storage type, or AI workflow.

## Acceptance checks for future work

Before a feature ships, verify:

1. A setting changed on web is honored by the other supported surface.
2. A user can disconnect an integration once and it becomes unavailable everywhere.
3. A user can delete or change shared information without leaving a second authoritative copy on another surface.
4. The same safety input yields the same safety-routing decision and region-aware resource disclosure on every surface.
5. Calendar context never causes an event write, notification, recording, or retention behavior without the required explicit consent.
6. No frozen Slack or simulator code is modified as part of shared-system work unless the freeze has ended and the work is separately approved.

## Change management

Any exception to this contract needs a written reason, product-owner approval, privacy/retention review, and a new version of this document. The owner reviews the contract every 90 days and before adding calendar writes, live meeting support, transcript/audio handling, broad browser context, or a new third-party integration.
