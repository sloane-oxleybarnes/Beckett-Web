# Shared web context contract

**Version:** 2026-07-29
**Applies to:** Home, Practice, Skills, Calendar & Meetings, and About Me.

Beckett has one web account context. A person should not need to restate their coaching preferences when they move between web surfaces, and a surface must not quietly expand what Beckett knows or does.

## What is shared

| Context | Source of truth | How it is used |
| --- | --- | --- |
| Coaching profile | `profiles` | Adjust tone, pacing, and suggested wording only when a user requests coaching. |
| Saved toolkit language | `course_toolkit_items` | Offer or adapt user-saved phrases in requested coaching. |
| Contacts | `contacts` and confirmed identifiers | Provide relationship context only when a specific contact is relevant to the current request. |
| Learning choices | `profiles` learning fields | Gate Home suggestions, pattern summaries, skill recommendations, and proactive meeting-prep suggestions. |
| Connected-service choices | `user_integrations` and selected Calendar metadata | Display connection status and use a connected service only within its user-facing feature. |
| Retention choices | `profiles` and workday preferences | Control whether Beckett keeps private workday patterns and the future meeting-retention preference. |
| Safety routing | `safety_resource_region` | Use the region selected by the user; never infer location. |

## What is not shared by default

- Raw Gmail messages, Gmail searches, Calendar events, OAuth credentials, or connection tokens.
- A contact's context unless the feature has matched that specific contact for the current request.
- A check-in, pattern, meeting note, transcript, or audio record unless the user opted into the related feature and its retention rule.
- Any new calendar change, notification, meeting support, or connection. Those require confirmation at the time of the action.

## Surface rules

1. **Home** can use connected Calendar timing and opted-in workday learning to make a current, consent-first suggestion.
2. **Practice** can use profile preferences and saved language to tailor a role-play or debrief. It does not receive raw connected-service content through the shared context.
3. **Skills** can use opted-in learning signals to recommend a relevant lesson only after enough user-owned signal exists.
4. **Calendar & Meetings** can read only the selected calendars and should offer proactive prep only when the user has opted into learning and earned a relevant signal.
5. **About Me** is the place to edit strengths, support considerations, and personal preferences; it must describe what will be shared before saving.

## Implementation guardrails

- `lib/shared-web-context.ts` is the account-level web contract and returns a safe browser summary plus a separate server-only prompt context.
- The browser endpoint (`/api/shared-context`) deliberately removes `promptContext` and never returns raw connected-service content or credentials.
- AI routes must treat shared context as tailoring information, not evidence: they may not diagnose, make claims about intent, or say they have accessed a connected service unless that service was explicitly supplied to the current request.
- New web surfaces should extend this contract rather than create an unrelated profile or preference store.

## User controls

Users can edit coaching preferences in Settings and About Me, manage contacts, change connected accounts, turn private learning off and clear its history, choose a safety-resource region, request account deletion, and review the Privacy Policy. Any future proactive or write action remains opt-in and confirmation-first.
