# Beckett Marketplace listing draft

## App name

Beckett

## Tagline

Understand workplace email and draft a response with more clarity.

## Short description

Analyze a selected Gmail™ conversation, understand its tone and asks, and create editable reply drafts with Beckett's communication coaching.

## Full description

Beckett is a workplace communication coach designed to help people understand email context and respond with clarity and confidence.

Open Beckett beside a Gmail™ conversation when you want support. Beckett can:

- Explain what is happening in the selected conversation.
- Describe observable tone without claiming to know another person's hidden intent.
- Surface requests, decisions, and unresolved next steps.
- Offer three editable reply approaches.
- Refine the suggestions with details you choose to add.
- Create a Gmail™ draft that you review, personalize, and send yourself.
- Use your Beckett coaching preferences and confirmed contact context when available.

Beckett processes Gmail™ content only after you choose an analysis or reply action. It does not automatically send email. Full Gmail™ message history is not stored by default. Optional email-style learning is off until the user enables it and stores compact style observations rather than full email bodies.

A Beckett account is required. Current plan and availability details must be stated on the final pricing/access page before submission.

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

No separate Beckett password, payment method, invitation, or manual approval is required.

### Installation and account connection

1. Sign into Google Workspace Marketplace™ with `gsmtestuser@marketplacetest.net`.
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

The reviewer account receives enough free credits to complete the workflow. No payment method or private-beta approval is required.

Support: `https://www.meetbeckett.co/support`

Gmail™ and Google Workspace™ are trademarks of Google LLC.

Never commit reviewer passwords or other credentials to this repository.
