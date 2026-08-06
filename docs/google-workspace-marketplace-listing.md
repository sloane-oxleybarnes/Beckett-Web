# Beckett Marketplace listing draft

## App name

Beckett

## Tagline

Understand workplace email and draft a response with more clarity.

## Short description

Analyze a selected Gmail conversation, understand its tone and asks, and create editable reply drafts with Beckett's communication coaching.

## Full description

Beckett is a workplace communication coach designed to help people understand email context and respond with clarity and confidence.

Open Beckett beside a Gmail conversation when you want support. Beckett can:

- Explain what is happening in the selected conversation.
- Describe observable tone without claiming to know another person's hidden intent.
- Surface requests, decisions, and unresolved next steps.
- Offer three editable reply approaches.
- Refine the suggestions with details you choose to add.
- Create a Gmail draft that you review, personalize, and send yourself.
- Use your Beckett coaching preferences and confirmed contact context when available.

Beckett processes Gmail content only after you choose an analysis or reply action. It does not automatically send email. Full Gmail message history is not stored by default. Optional email-style learning is off until the user enables it and stores compact style observations rather than full email bodies.

A Beckett account is required. Current plan and availability details must be stated on the final pricing/access page before submission.

## Scope explanations

### Open-message action access

Beckett uses the add-on-specific current-message action scope to retrieve the Gmail message or available thread context selected by the user after the user clicks an analysis action. It does not request mailbox-wide read access.

### Draft action access

Beckett uses the add-on-specific compose action scope only after the user selects **Use in Gmail draft**. Beckett creates an editable draft in Gmail. The user must review and send the email from Gmail.

### Google identity

Beckett uses OpenID and the verified Google email address to locate or explicitly link the user's Beckett account. It does not use the email address for advertising.

## Reviewer account notes

Replace these placeholders before submission:

- Reviewer Beckett account: `[REVIEWER_EMAIL]`
- Temporary password or Sign in with Google instructions: `[REVIEWER_LOGIN]`
- Test Gmail conversation: `[TEST_THREAD_INSTRUCTIONS]`
- Account tier and expiration: `[REVIEWER_PLAN]`
- Support contact during review: `hello@meetbeckett.co`

Never commit a reviewer password to this repository. Add it only in Google's protected reviewer-instructions field.
