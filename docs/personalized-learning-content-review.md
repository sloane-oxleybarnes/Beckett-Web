# Personalized learning content review — staging

## What can be recommended now

Only content that is published and reachable in the staging app is eligible for an earned recommendation.

| Area | Live content | Recommendation relationship |
| --- | --- | --- |
| Professional skills | Asking for Clarity at Work; Introducing yourself to a new colleague | Repeated completed Practice on the same topic can suggest the matching course. A completed course can suggest a linked Practice scenario. |
| Personal skills | Asking someone out on a dating app | Repeated completed Practice on the same topic can suggest the matching course. A completed course can suggest a linked personal Practice scenario. |
| Practice | Professional and personal guided scenarios | The user may open Practice directly from Skills or from a course-earned suggestion. |

## Eligibility and guardrails

- A course suggestion requires either two matching completed Practice sessions within a three-week window, with at least three completed sessions overall, or one matching session plus a related support preference/pattern the user explicitly saved.
- A completed course can earn one optional linked Practice suggestion. This is not a behavioral inference; it follows directly from a course the user completed.
- Users must turn on both private pattern learning and skill recommendations. They can save, dismiss, or pause a recommendation at any time.
- Gmail, Calendar, Slack, raw check-ins, and raw Practice conversation text are not used as recommendation input. Only limited, user-owned signals are evaluated server-side.
- A saved/dismissed recommendation is not shown again unless the user removes it from **Skills and courses** or re-enables recommendations in settings.

## Content that remains out of recommendation flows

`lib/skills.ts` contains broader workplace, dating, family/friends, self-advocacy, and personal modules, but several contain draft/TODO material or do not yet have complete user-facing routes. They must remain unavailable for automatic recommendations until each module has:

1. Finished learning content and accessibility review.
2. A published course or supported Practice route.
3. Clear completion/progress handling.
4. A user-facing explanation of how it will be recommended.

This keeps the recommendation system useful without representing planned content as available.
