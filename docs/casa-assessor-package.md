# Beckett CASA AL1 assessor package (production-port preflight evidence)

Prepared: July 31, 2026
Scope: Beckett web application production-port branch `codex/production-casa-port`, validated in an isolated Vercel preview.
The published Chrome extension, Slack behavior, and simulator are excluded from this change set and remain unchanged.

## System and data-flow summary

Beckett is a browser-based communication coach. A signed-in user can optionally connect Google Gmail and Google Calendar. Gmail is used only for a user-selected thread sent to Decode; Calendar is used to list the calendars the user selects and read event titles, timing, and attendees for the week view and meeting preparation. Credentials are encrypted at rest with AES-256-GCM and are used only by server-side routes. Google API data is not used for generalized model training or advertising.

The web app also has authenticated coaching, practice, skills, contacts, workday, safety, and account settings routes. HubSpot and Loops are server-side beta/CRM workflows only. Stripe is currently signature-verified but has no active billing event side effects. Slack and extension routes are existing frozen surfaces and are not modified by this staging hardening branch.

## Controls implemented for this review

- Account deletion runs immediately from Settings, revokes all decrypted Google access and refresh credentials, removes connected HubSpot/Loops/Stripe records when configured, clears Beckett records, and deletes the Supabase Auth user.
- Direct public HubSpot and Loops mutation endpoints return `410`; authenticated Beckett workflows are the only application paths that call those providers.
- Beta signup validates email, name, plan, and source, bounds the request body, and applies IP and per-email rate limits before any external-provider calls.
- Stripe webhooks require the configured secret and `stripe-signature`, cap raw payload size, and call Stripe `constructEvent` before acknowledging an event.
- Admin authentication uses an HMAC-signed, expiring, HttpOnly, Secure, SameSite=Strict opaque session cookie. Login attempts are rate limited.
- Auth callback destinations are allowlisted to internal dashboard/password-setup/beta paths; protocol-relative and external redirects are rejected.
- Gmail contact-wide mailbox search is disabled. The old contact-context endpoint returns `410`; the submitted product flow is a user-selected Gmail Decode thread.
- Authenticated AI, practice, course, calendar, upgrade, and account-deletion routes have bounded JSON bodies and per-user rate limits. Calendar selection is checked against the user’s available calendars.
- Global response headers include `nosniff`, strict referrer policy, frame protection, permissions policy, COOP, and CORP. API responses are `no-store`; the app does not add wildcard `Access-Control-Allow-Origin` headers.
- Dependencies remain on the production-compatible Next.js 14.2.35 line. Direct and transitive fixes for Sharp, brace-expansion, fast-uri, and PostCSS used by the application toolchain were applied without forcing a breaking Next.js major upgrade.

## Reviewer test path

Use a staging test account supplied separately by the Beckett team; do not place credentials in this document or in a video. The reviewer should:

1. Open the staging URL and sign in.
2. Open Settings → Connected accounts and verify Gmail and Calendar are opt-in, read-only connections.
3. Connect Gmail, open a harmless test message, and invoke Decode on that selected thread. Confirm Beckett does not send or modify email.
4. Connect Calendar, select one or more subscribed calendars, and confirm the week view shows event title, time, and attendee names without write controls.
5. Open Settings → Privacy and Trust and run account deletion. Confirm the account is signed out, provider credentials are revoked, and the user cannot access the deleted account.
6. Send unsigned and malformed requests to `/api/stripe/webhook`; expect `400`. Send an oversized request; expect `413`. A correctly signed test event is acknowledged without an unconfigured billing side effect.
7. Submit repeated beta signup, admin login, AI, and calendar requests; confirm `429` responses after the documented thresholds.
8. Verify `/api/hubspot`, `/api/loops`, and `/api/gmail/contact-context` return `410` for direct/legacy mutation or contact-wide-search attempts.

## Automated evidence

From the repository root:

```bash
npm ci
npm run test:security-hardening
npm run lint
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=build-anon-key \
SUPABASE_SERVICE_ROLE_KEY=build-service-key \
npm run build
npm audit --omit=dev --audit-level=high
```

The build and lint commands passed on this branch. The audit reports two upstream high findings in the production-compatible dependency tree: the remaining Next.js 14 advisory range and a nested PostCSS version pulled by Next.js 14. Forcing `npm audit fix --force` would install a breaking Next.js major upgrade, so these residuals are documented rather than hidden with an unsafe override.

## Items requiring the assessor/operator

- Run the official CASA AL1 assessment with an ADA-authorized lab and provide the lab the staging test account, deployment inventory, provider contracts, and this package.
- In the Supabase production Auth dashboard, enable leaked-password protection and set the approved OTP expiry. These are hosted Auth settings rather than application code and are intentionally not changed by this branch.
- Configure a strong random `ADMIN_SESSION_SECRET` in the production secret store; the code has a password-derived fallback only to preserve existing access during rollout. Do not promote until the explicit secret is present.
- Keep provider API keys, OAuth client secrets, test passwords, and encryption keys outside Git and outside the assessor video.

This document is an engineering preflight package, not a CASA Letter of Validation. The ADA-authorized assessor remains the authority for the formal security assessment.
