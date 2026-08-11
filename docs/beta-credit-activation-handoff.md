# Beta credit activation handoff

The new website credit system is implemented but deliberately disabled during Slack hackathon judging.

## Before August 12, 2026

- Keep `WEB_CREDIT_SYSTEM_ENABLED` unset or set to `false` in every Vercel environment.
- Do not change Slack access, Slack usage metering, Slack routes, or Slack configuration.
- Website Practice recovery, invite-only beta access, legal copy, and the corrected public pricing copy can ship independently.

## On or after August 12, 2026

1. Set `WEB_CREDIT_SYSTEM_ENABLED=true` in the intended Vercel environment and redeploy.
2. Verify the bottom-right credit tracker appears above Feedback.
3. Test Beta limits (60 daily / 500 monthly), Free first-day limits (20 daily / 80 first month), and normal Free limits (10 daily / 70 monthly).
4. Verify failed AI responses do not reduce the tracker.
5. Verify Free users may open two courses per month and course activity does not reduce coaching credits.
6. Verify Free users can use extension-based coaching but cannot open standalone web Practice.
7. In a separate Slack-only change, add Free-plan Slack access and charge one credit only for each successful user-visible Slack coaching response. RTS and background work must not charge extra.
8. Re-run the logged-in and guest Slack pressure tests after that Slack-only change.

Internal accounts using `hello@meetbeckett.co` or a `hello+anything@meetbeckett.co` alias are unlimited in the new website credit system. Additional internal accounts can be listed in `WEB_UNLIMITED_CREDIT_EMAILS` as a comma-separated environment variable.
