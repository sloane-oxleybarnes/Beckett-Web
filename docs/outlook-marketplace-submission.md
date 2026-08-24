# Beckett for Outlook — Microsoft Marketplace submission

This is the release checklist and certification handoff for the public Beckett
Outlook add-in offer in Microsoft Partner Center.

## Production package

- Manifest: `docs/outlook-addin-manifest-production.xml`
- Redacted screenshot: `docs/outlook-marketplace-screenshot-redacted-1280x720.png`
- Production task pane: `https://www.meetbeckett.co/outlook-addin`
- Support: `https://www.meetbeckett.co/support`
- Privacy: `https://www.meetbeckett.co/privacy`
- Terms: `https://www.meetbeckett.co/terms`
- Manifest ID: `90c2f2db-20b8-4c6f-91e7-9cba3b5c4b5e`
- Manifest version: `1.0.0.3`
- Publisher: `Beckett Labs Inc.`
- Manifest permission: `ReadWriteItem`
- Mailbox requirement set: `1.5`

Keep the manifest ID stable. Increment the four-part version only when a
replacement manifest is uploaded.

## Store listing copy

### App name

Beckett

### Short description

Decode for Outlook: understand tone and draft clearer replies in your own voice.

### Long description

Beckett is a private communication coach built into Outlook. Open Beckett on a
message or draft to separate what the words clearly say from uncertain tone,
understand what the sender may be asking for, and choose a useful next step.
Beckett provides three editable response options with different communication
styles. You can copy a response, insert it into an open draft, or open a reply
with the response ready for your review. Optional full-thread analysis is
available after you approve Microsoft's delegated, read-only Mail.Read
permission. Beckett acts only after you choose an analysis action and never
sends email. You remain in control of every draft and message.

### Search terms

communication, email, coaching, tone, reply, workplace, accessibility

## Partner Center fields

- [ ] Publisher display name is exactly `Beckett Labs Inc.`
- [ ] Offer type is an Office Add-in targeting Outlook.
- [ ] **My product requires Azure AD** is selected.
- [ ] Pricing and the Beckett account/external-service requirement are disclosed.
- [ ] Availability, markets, and `en-US` are selected.
- [ ] Support contact, privacy policy, and terms URLs are entered.
- [ ] Store logo, screenshots, short description, and long description are uploaded.
- [ ] Screenshots mask all names, email addresses, mailbox labels, and other personal information.
- [ ] Encryption disclosure says HTTPS/TLS protects data in transit and AES-256-GCM protects stored Microsoft OAuth credentials.
- [ ] A dedicated reviewer account has completed onboarding, has available credits, and does not require developer intervention.
- [ ] Certification notes contain the walkthrough below, without placing the password in source control.

## Certification notes template

Beckett is a communication-coaching service. Use the reviewer credentials in
Partner Center; no payment method or manual approval is required.

1. Install Beckett and open any safe sample message in Outlook.
2. Open Beckett from the message ribbon or Apps menu.
   Before sign-in, confirm the start screen explains that Beckett clarifies
   intent and uncertain tone, creates editable responses, and never sends email.
3. Select **Connect Microsoft account**. If Microsoft SSO is unavailable in the
   test mailbox, select **Sign in to Beckett** and complete sign-in in the secure
   Outlook dialog.
4. Select **Analyze message**. Confirm that intent, tone, what the sender may
   want, and three response options appear.
5. Select **Analyze full thread**. If prompted, choose **Connect full-thread
   permission**, complete Microsoft's delegated Mail.Read consent, return to
   Outlook, and select **Analyze full thread** again.
6. Open a draft or reply, run **Analyze message**, then choose **Insert into
   reply** or **Open reply with response**.
7. Confirm that Beckett inserts editable text but never sends the message.

The manifest requests `ReadWriteItem` to read the current item only after the
user acts and to place text into the current draft. Full-thread analysis is a
separate user action that requests delegated `Mail.Read`. Beckett does not
request `ReadWriteMailbox`, background mail access, or mail-send permission.

## External configuration gate

Before production testing, confirm all of the following against the production
Entra and Supabase projects:

- [ ] The Entra app display name is production-appropriate (not “Staging”).
- [ ] Supported account types include organizational directories and personal Microsoft accounts.
- [ ] The SPA redirect URI is exactly `brk-multihub://www.meetbeckett.co`.
- [ ] The web redirect URI is exactly `https://www.meetbeckett.co/api/microsoft/oauth/callback`.
- [ ] Delegated `User.Read` is configured; `Mail.Read` is requested incrementally by the app.
- [ ] Supabase Site URL is `https://www.meetbeckett.co`.
- [ ] Supabase Redirect URLs permit `https://www.meetbeckett.co/auth/callback`.

## Release verification

- [ ] Run `npm run verify:outlook` from the repository root.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Deploy the exact commit being submitted.
- [ ] Verify every manifest URL returns HTTPS 200 without authentication.
- [ ] Test modern Outlook on the web, new Outlook for Windows, and Outlook for Mac.
- [ ] Test both NAA and **Sign in to Beckett** fallback authentication.
- [ ] Test message analysis, incremental full-thread consent, copy, insert, and open-reply behavior.
- [ ] Confirm selected Outlook content is not stored by default.
- [ ] Capture a redacted 1280×720 screenshot showing a completed analysis.
- [ ] Upload the manifest, listing assets, reviewer credentials, and certification notes in Partner Center.
- [ ] Review the final package, then select **Submit**.

Never commit reviewer passwords or other credentials to this repository.
