# Beckett add-in for Microsoft Outlook Marketplace submission

## Product identity

- Name: `Beckett`
- Publisher: `Beckett Labs Inc.`
- Manifest ID: `90c2f2db-20b8-4c6f-91e7-9cba3b5c4b5e`
- Primary language: `en-US`
- Production manifest: `docs/outlook-addin-manifest-production.xml`

## Summary

Understand confusing Microsoft Outlook messages with private, user-invoked communication coaching.

## Description

Beckett is a communication coach designed to make confusing workplace messages easier to understand. Open the Beckett add-in beside a received Microsoft Outlook message when you want help separating what the message visibly says from possible interpretations.

After you open Beckett on a message, the add-in shows the selected sender and subject. Nothing is sent to Beckett until you choose **Decode with Beckett**. Beckett then analyzes the selected message and returns three concise sections: a likely reading, what the message appears to ask, and a possible next move.

Beckett is intentionally cautious about hidden intent. It distinguishes visible evidence from interpretation and does not claim to know what another person thinks or feels. Its suggestions are AI-generated and should be reviewed in light of your own workplace and circumstances.

The Marketplace version is read-only. It does not scan your mailbox in the background, read attachments, modify messages, create or insert drafts, or send mail. It only reads the message on which you explicitly open the add-in, and it sends that selected content for analysis only after you choose Decode.

A free Beckett account is required. Users can sign in or create an account from the task pane. During beta, Beckett is available to adults age 18 or older in the United States and may apply clearly disclosed usage limits.

Microsoft, Microsoft 365, and Outlook are trademarks of the Microsoft group of companies.

## Permissions justification

The add-in requests the Outlook `ReadItem` permission so it can read the sender, subject, and plain-text body of the one message on which the user opens Beckett. It does not request `ReadWriteItem`, mailbox-wide Graph mail access, or permission to send mail.

## Required URLs

- Support: `https://www.meetbeckett.co/support`
- Privacy policy: `https://www.meetbeckett.co/privacy`
- Terms/EULA: `https://www.meetbeckett.co/terms`
- Product website: `https://www.meetbeckett.co`

## Assets

- Manifest icon: `public/brand/outlook-icon-64.png`
- High-resolution icon: `public/brand/outlook-icon-128.png`
- Command icons: `public/brand/outlook-icon-16.png`, `outlook-icon-32.png`, and `outlook-icon-80.png`
- Marketplace listing icon: `public/brand/outlook-marketplace-icon-300.png`
- Redacted 1280 x 720 source screenshot: `docs/marketplace-assets/outlook-decode-1280x720.png`
- Partner Center 1366 x 768 screenshot: `docs/marketplace-assets/outlook-decode-1366x768.png`

## Certification test notes

Provide a dedicated reviewer account that is active for the full review period. Replace the placeholders below only in Partner Center; do not commit credentials.

- Reviewer email: `outlook-reviewer@meetbeckett.co`
- Reviewer password: `[PARTNER CENTER ONLY]`
- Additional purchase required: `No` for the beta submission, unless this changes before submission.

Test flow:

1. Install the production manifest and open modern Outlook on the web.
2. Open a received email with a non-empty subject and body.
3. Choose **Beckett** from the message command bar.
4. Confirm that the task pane explains the value before sign-in.
5. Select **Sign in to Beckett** and use the reviewer credentials.
6. Confirm that the dialog closes and the task pane shows the reviewer email.
7. Select **Decode with Beckett**.
8. Confirm that Beckett returns **Likely read**, **What it asks**, and **Possible next move**.
9. Confirm that the original Outlook message is unchanged and that no message or draft is sent or created.
10. Select **Sign out** and confirm that Decode becomes unavailable until the reviewer signs in again.

Repeat the core flow in new Outlook for Windows and Outlook for Mac. Record tested versions and dates in the Partner Center certification notes.

Cryptography disclosure for the Partner Center certification notes:

> Beckett uses industry-standard HTTPS/TLS for data in transit and AES-256-GCM and platform-managed encryption for stored OAuth tokens and service data. Beckett relies on standard platform cryptography and does not expose cryptographic functionality to users.

## Verification record

- Modern Outlook on the web (Chrome): passed end-to-end on August 10, 2026.
- Outlook for Mac: pending; Microsoft Outlook is not installed in the available macOS environment.
- New Outlook for Windows: pending; no Windows machine or VM is available in the current workspace.

## Before submission

- [x] Deploy the task pane, support page, privacy changes, terms changes, and all icon files to `www.meetbeckett.co`.
- [x] Product decision: use self-service free account creation for Marketplace distribution.
- [x] Set `BETA_INVITE_ONLY=false` in production and smoke-test new account creation.
- [x] Confirm `NEXT_PUBLIC_SITE_URL=https://www.meetbeckett.co` and the Supabase redirect allowlist includes the production authentication routes.
- [x] Confirm the Partner Center public publisher name matches `Beckett Labs Inc.`.
- [x] Run `npx office-addin-manifest validate -p docs/outlook-addin-manifest-production.xml` after deployment.
- [x] Confirm every production manifest and listing URL returns HTTPS 200 without authentication.
- [x] Upload a matching listing icon and at least one redacted screenshot.
- [x] Paste the reviewer credentials and test flow into Partner Center certification notes.
- [x] Enter the app's HTTPS/TLS and AES-256-GCM cryptography disclosure in the Partner Center certification notes.
- [ ] Reapply for Microsoft Developer verification and resolve the failed Employment Verification check; Partner Center currently reports the Developer application as rejected and closed.
