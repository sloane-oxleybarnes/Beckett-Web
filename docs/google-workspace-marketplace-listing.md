# Beckett Marketplace listing and reviewer instructions

This document mirrors the English Store Listing saved in the production Google Workspace Marketplace SDK and keeps the reviewer walkthrough with the release source.

## Store Listing

### Application name

Beckett

### Short description

Decode Gmail™ tone and draft clearer replies in your own voice.

### Detailed description

Beckett is a communication coach built directly into Gmail™. Open Beckett on a selected conversation to separate what the message clearly says from uncertain tone, understand what the sender is asking for, and choose a useful next move. When you want to respond, Beckett creates three editable reply options with different communication styles. You can refine them with additional instructions and place your preferred response into a Gmail™ draft for review. Beckett can also use the communication preferences and contact context saved in your Beckett account to make suggestions more relevant to you. Beckett only analyzes the Gmail™ conversation you choose to open with the add-on. It does not send email automatically. You remain in control of every draft and message.

Gmail™ and Google Workspace™ are trademarks of Google LLC.

## Scope explanations

### Open-message action access

Beckett uses the add-on-specific current-message action scope to retrieve the Gmail™ message or available thread context selected by the user after the user clicks an analysis action. It does not request mailbox-wide read access.

### Draft action access

Beckett uses the add-on-specific compose action scope only after the user selects **Use in Gmail™ draft**. Beckett creates an editable draft in Gmail™. The user must review and send the email from Gmail™.

### Google identity

Beckett uses OpenID and the verified Google email address to locate or explicitly link the user's Beckett account. It does not use the email address for advertising.

## Reviewer instructions

### Reviewer account

Use Google's reviewer account:

`gsmtestuser@marketplacetest.net`

The reviewer address is included as a Marketplace draft tester. No separate Beckett password, payment method, invitation, or manual approval is required.

### Installation and account connection

1. Sign into Google Workspace Marketplace with `gsmtestuser@marketplacetest.net`.
2. Open the Beckett Marketplace listing and select **Individual install**.
3. Approve the requested permissions.
4. Open Gmail™ and select Beckett from the right sidebar.
5. If the account-connection card appears, select **Create free Beckett account**.
6. Select **Continue with Google** and use `gsmtestuser@marketplacetest.net`.
7. Complete the short onboarding flow.
8. Select **Connect these accounts**.
9. Return to Gmail™ and reopen Beckett.

### Functional test

1. Open any safe multi-message email conversation in Gmail™.
2. Select Beckett and choose **Analyze email**.
3. Expand the **What's happening**, **Tone**, and **What they want** sections.
4. Select **Help me reply**.
5. Expand the three reply categories:
   - **Direct and clear**
   - **Warm and collaborative**
   - **Sets a gentle limit**
6. In the refinement field, enter: `Mention that I can own the Monday handoff.`
7. Select **Update responses**.
8. Expand a revised response and select **Use in Gmail™ draft**.
9. Confirm that Gmail™ opens an editable draft and that Beckett does not send it.

### Permissions

- Current-message action access reads only the conversation selected by the reviewer.
- Compose action access creates the reviewer-selected Gmail™ draft.
- Identity access associates the Google account with the reviewer's Beckett account.

### Access and support

New free accounts receive enough credits to complete the review workflow. No payment method or private-beta approval is required. Email-style learning is off by default.

Support: `https://www.meetbeckett.co/support`

Gmail™ and Google Workspace™ are trademarks of Google LLC.

Never commit reviewer passwords or other credentials to this repository.
