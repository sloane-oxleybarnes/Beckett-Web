# Google Workspace Marketplace launch runbook

This runbook prepares Beckett's HTTP Gmail add-on for public Marketplace distribution. It does not authorize a production deployment or Marketplace submission by itself.

## Release decision

- Target audience: public Marketplace listing with individual installation enabled.
- Managed Workspace administrators can still restrict or allowlist the add-on.
- Keep the staging and production Google Cloud projects, HTTP deployments, OAuth credentials, Vercel environments, and Supabase projects separate.
- Do not save a private Marketplace visibility setting for the intended public project. Google treats the public/private visibility choice as permanent.

## Code and data gates

- [ ] Merge the verified Gmail add-on routes to the production branch.
- [ ] Apply `20260806202250_google_workspace_addon_link_sessions.sql` and `20260806202652_restrict_google_workspace_addon_link_sessions.sql` to production Supabase.
- [ ] Rotate the production Supabase service-role key and update all authorized server environments before release.
- [ ] Confirm `https://www.meetbeckett.co/api/google-workspace-addon/home` serves the POST handler directly without a redirect after deployment.
- [ ] Configure production `GOOGLE_WORKSPACE_ADDON_CLIENT_ID` from the production HTTP deployment authorization resource.
- [ ] Configure production `GOOGLE_WORKSPACE_ADDON_SERVICE_ACCOUNT_EMAIL` from that same deployment.
- [ ] Set production `GOOGLE_WORKSPACE_ADDON_ORIGIN=https://www.meetbeckett.co`.
- [ ] Verify the add-on never uses preview deployment URLs.

## Access model

- [x] Product decision: open free account creation for public Marketplace users.
- [x] Restore the public signup page behind the `BETA_INVITE_ONLY=false` environment policy.
- [x] Preserve the Gmail account-link return path through signup, email confirmation, Google OAuth, and onboarding.
- [ ] Set `BETA_INVITE_ONLY=false` in production only as part of the approved production release.
- [ ] Complete a production smoke test with a brand-new account before Marketplace submission.

The add-on now supports explicit linking when the Gmail and Beckett login emails differ. It uses a 30-minute, one-time opaque token, requires an authenticated Beckett session, shows both account emails, and requires confirmation before linking.

## Scope freeze

Use the exact scopes in `google-workspace-addon/deployment.production.json`:

- `gmail.addons.current.message.action` — access the open message only after an add-on action.
- `gmail.addons.current.action.compose` — create a Gmail draft after the user selects **Use in Gmail draft**; Beckett does not send it.
- `userinfo.email`, `userinfo.profile`, and `openid` — receive and verify the user's Google identity for account matching, including a display name/profile image when available.
- `gmail.addons.execute` — add-on execution compatibility in the HTTP deployment.

Do not add broad `gmail.readonly`, `gmail.compose`, `gmail.modify`, or `mail.google.com` scopes. The current add-on-specific scopes avoid restricted, mailbox-wide access.

## Google Cloud and OAuth

- [ ] Create or select the production Google Cloud project owned by the Beckett organization.
- [ ] Keep at least two current project owners and a monitored project contact email.
- [ ] Verify `meetbeckett.co` ownership in Google Search Console using a project owner/editor account.
- [ ] Configure the OAuth audience as External and move it to In production when ready for verification.
- [ ] Set app name, logo, support email, homepage, privacy policy, and terms URLs consistently.
- [ ] Add only the frozen scopes above.
- [ ] Enable the Google Workspace Marketplace SDK (not the separate licensing API).
- [ ] Create the production HTTP deployment using `google-workspace-addon/deployment.production.json`.
- [ ] Record its OAuth client ID and service-account email in the production environment.

## Reviewer journey

- [ ] Provide a Beckett reviewer account with completed onboarding and available Gmail coaching credits.
- [ ] Provide a second Google account or documented path for testing cross-email account linking.
- [ ] Show first install and granular authorization.
- [ ] Show the account-required card and successful account connection.
- [ ] Analyze a selected four-message thread.
- [ ] Generate all three reply approaches.
- [ ] Refine replies with an optional user instruction.
- [ ] Create a Gmail draft and demonstrate that Beckett does not send it.
- [ ] Show confirmed-contact personalization and the fallback for an unknown contact.
- [ ] Show email-style learning off by default, opt in, and opt out.
- [ ] Demonstrate permission denial, expired account-link token, plan/credit exhaustion, and a recoverable API error.

## Marketplace assets

- [ ] App icon matching the add-on logo.
- [ ] Short and full descriptions from `docs/google-workspace-marketplace-listing.md`.
- [ ] Screenshots of analysis, reply options, refinement, draft creation, and account connection.
- [ ] Homepage: `https://www.meetbeckett.co/`.
- [ ] Privacy: `https://www.meetbeckett.co/privacy`.
- [ ] Terms: `https://www.meetbeckett.co/terms`.
- [ ] Support: `hello@meetbeckett.co` and a public support page before submission.
- [ ] Pricing/access page that states current account and plan requirements.
- [ ] EEA trader-status response completed in the Marketplace SDK.

## Release sequence

1. Complete all staging tests and public-user onboarding.
2. Freeze scopes and listing copy.
3. Deploy the verified code and migrations to production only after explicit approval.
4. Create/install the unpublished production HTTP deployment for a small internal production smoke test.
5. Record the OAuth/reviewer video against the production candidate.
6. Complete OAuth or brand verification required by the console's scope classification.
7. Submit the public Marketplace listing with deferred publishing if offered.
8. After approval, run one final install test, then publish the listing.
9. Add the Marketplace link to Beckett onboarding, Settings, and the integrations page.

## Rollback

- Keep the previous production application commit and Vercel deployment addressable.
- The Google HTTP deployment must keep the same stable `www.meetbeckett.co` endpoint origin.
- Roll back the Vercel alias/deployment rather than changing Marketplace endpoints during an incident.
- Disable Marketplace visibility or unpublish the listing only for a material security or availability incident.
- Never roll back the account-link migration by dropping tables while active link tokens or mappings may exist.
