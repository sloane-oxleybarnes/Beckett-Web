# Outlook real-client certification test record

Last updated: August 24, 2026 (America/Los_Angeles)

This record covers the production Beckett Outlook add-in at
`https://www.meetbeckett.co/outlook-addin` using non-sensitive reviewer test
mail. It does not contain reviewer credentials.

## Required client matrix

| Client | Authentication | Selected message | Full thread | Copy | Draft insertion | Open reply | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Modern Outlook on the web | Pass: fresh memory-only NAA session reconnected through Microsoft SSO; Beckett fallback remains to be exercised with reviewer credentials | Pass | Pass: incremental delegated `Mail.Read` consent completed and a 3-message conversation was analyzed | Pass: embedded-webview copy fallback placed the selected response on the macOS system clipboard | Pass | Pass | Pass except fallback-authentication walkthrough |
| New Outlook for Windows | Not run | Not run | Not run | Not run | Not run | Not run | Blocked: no Windows client, VM, Cloud PC, or remote Windows session is available on this machine |
| Outlook for Mac | Microsoft certification reported that **Connect Microsoft account** appeared nonresponsive in Outlook 16.110.3. The start screen now shows immediate progress, bounds NAA waits, and keeps the Beckett fallback available. Retest required. | Not run | Not run | Not run | Not run | Not run | Blocked locally: Outlook is installed, but the available Microsoft 365 test mailbox is not licensed for Outlook for Mac |

## Modern Outlook on the web evidence

Test mailbox: Microsoft 365 account in modern Outlook on the web.

Test conversation: `Reviewer Scenario 1 — Launch timeline alignment`.

### Passed

- Beckett opened from the Outlook ribbon and reported `Connected through Microsoft SSO.`
- **Analyze message** completed against the selected message and returned intent,
  tone, what the sender may want, and three response options.
- **Open reply with response** created a saved Outlook reply draft with Beckett's
  selected response as editable body text. No message was sent.
- Beckett opened in the saved draft, analyzed the draft, and showed three
  response options with **Insert into reply** actions.
- **Insert into reply** inserted the selected response into Outlook's editable
  message body. Beckett reported `Inserted into the draft. Review it before
  sending.` No message was sent.
- Selecting **Analyze full thread** did not request broad permissions silently.
  Beckett stopped at an explicit explanation of delegated, read-only
  `Mail.Read` and displayed **Connect full-thread permission**.
- The incremental Microsoft consent screen identified verified publisher
  **Beckett Labs Inc.** and requested **Read your mail**. After consent, the
  task pane detected the connected permission without being reinstalled.
- **Analyze full thread** then read and analyzed the selected 3-message
  conversation and returned intent, tone, what the sender may want, and three
  response options.
- A cold task-pane reload completed a fresh, memory-only NAA connection and
  reported `Connected through Microsoft SSO.`
- **Copy response** placed the selected response on the macOS system clipboard
  after the Outlook-webview-compatible copy path was deployed.

### Incomplete

- Fallback **Sign in to Beckett** has not yet been run because the task pane
  successfully reconnects through NAA and the reviewer password must remain
  outside the repository.

### Production configuration verified during the test

- Added a sensitive, Production-only `MICROSOFT_TOKEN_ENCRYPTION_KEY` in
  Vercel.
- Created a dedicated Entra client secret for the production OAuth flow,
  stored it as sensitive, Production-only `MICROSOFT_CLIENT_SECRET` in Vercel,
  and recorded its rotation deadline as August 18, 2028.
- The copy correction was verified in production from release commit
  `30d158d5762ba02fb517ae9f78ad525a35b94d13`.
- Confirmed the saved Microsoft integration now includes delegated
  `Mail.Read` and that the full-thread request succeeds in Outlook on the web.
- Reran `npm run validate:outlook`; Microsoft's validation and acceptance-test
  service reported that the production manifest is valid.

## Native-client access needed

### Outlook for Mac

Microsoft Outlook for Mac is installed. The available tenant account reports
that its license does not enable Outlook for Mac, so a desktop-Outlook-eligible
Microsoft 365 mailbox is still required to repeat every behavior in the matrix.
Microsoft's August 21 certification report separately reproduced an
authentication problem on Outlook for Mac 16.110.3. The August 24 correction
adds immediate progress feedback, bounded NAA waits, a clear recovery message,
and an always-available secure Beckett sign-in fallback.

### New Outlook for Windows

Provide one of the following real Windows test surfaces:

- a Windows 11 machine with new Outlook;
- a Windows VM on this Mac; or
- a Windows 365 Cloud PC or remote Windows session.

Browser-only emulation is not acceptable evidence for the Windows client row.

## Microsoft certification basis

The test plan follows the
[Microsoft Marketplace certification policies](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies)
for Microsoft 365 add-ins: submissions must be testable, the offer must deliver
its listed functionality, and Outlook add-ins using SSO must provide a fallback
authentication method. Modern Outlook on the web is a required supported client
for Outlook add-ins.
