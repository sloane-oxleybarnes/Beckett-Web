# Beckett for Outlook — Microsoft Marketplace submission

This checklist prepares the add-in-only XML manifest for a public Outlook
listing through Microsoft Partner Center.

## Submission package

- Manifest: `docs/outlook-addin-manifest-production.xml`
- Production task pane: `https://www.meetbeckett.co/outlook-addin`
- Support: `https://www.meetbeckett.co/support`
- Privacy: `https://www.meetbeckett.co/privacy`
- Terms: `https://www.meetbeckett.co/terms`
- Manifest ID: `90c2f2db-20b8-4c6f-91e7-9cba3b5c4b5e`
- Manifest version: `1.0.0.0`
- Permission: `ReadWriteItem`
- Mailbox requirement set: `1.5`

Keep the manifest ID stable for every update. Increment the four-part manifest
version when submitting a replacement package.

## Partner Center details to confirm

- [ ] The Partner Center publisher display name matches `Beckett Labs Inc.`
- [ ] The offer is an Office Add-in that targets Outlook.
- [ ] The listing clearly says that an approved Beckett account is required.
- [ ] Pricing and the external-service requirement are disclosed accurately.
- [ ] Market availability and supported languages are selected.
- [ ] Support contact, privacy policy, and terms URLs are entered.
- [ ] Store logo, screenshots, short description, and long description are uploaded.
- [ ] A reviewer test account is active and does not require developer interaction.
- [ ] Certification notes include the test flow below.

## Certification test notes template

Beckett is an invite-only workplace communication coaching service. Use the
provided reviewer account; public self-registration is not available.

1. Install Beckett in Outlook and open any sample email message.
2. Open Beckett from the message ribbon or Apps menu.
3. Sign in with the reviewer credentials in the new browser tab, return to the
   Outlook pane, and select **Refresh sign-in**.
4. Select **Read selected item**. The subject, sender, and body preview appear
   only after this action.
5. Select **Decode with Beckett** and confirm that coaching appears.
6. Open a new draft, open Beckett, read the draft, decode it, and select
   **Insert into current draft**.
7. Confirm that Beckett inserts text but never sends the message.

The add-in requests `ReadWriteItem` so it can read only the current item after
the user acts and insert text into the current draft. It does not request
`ReadWriteMailbox`, background mail access, or send permission.

## Pre-submission verification

- [ ] Run `npx office-addin-manifest validate -p docs/outlook-addin-manifest-production.xml`.
- [ ] Verify every manifest URL returns HTTPS 200 without authentication.
- [ ] Test Outlook on the web.
- [ ] Test new Outlook for Windows.
- [ ] Test classic Outlook for Windows.
- [ ] Test Outlook for Mac.
- [ ] Confirm sign-in survives the embedded Outlook task-pane environment.
- [ ] Confirm selected message content is not stored by default.
- [ ] Confirm the support page accurately describes the shipped behavior.
- [ ] Provide stable reviewer credentials and sample data in Partner Center.

## Account-only steps

These steps require the Beckett Partner Center owner:

1. Enroll the legal publisher in Microsoft Partner Center if it is not already enrolled.
2. Create the Office Add-in offer.
3. Complete the listing, availability, properties, and certification fields.
4. Upload the validated XML manifest and listing assets.
5. Add test credentials and the certification notes.
6. Review and submit the offer for certification.
