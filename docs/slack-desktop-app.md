# Beckett Slack Desktop App

This is the Slack-only hackathon path for using Beckett inside Slack Desktop. It is separate from the Chrome extension, Gmail, courses, and the broader Beckett beta product.

## What This Adds

- Slash command: `/beckett`
- Message shortcuts: `Beckett - Decode` and `Beckett - Respond`
- Hackathon positioning: Beckett prepares neurodivergent workers for the conversations that matter at work
- Signed Slack request verification with `SLACK_SIGNING_SECRET`
- Beckett account matching through the existing `user_integrations` Slack connection
- Minimal private acknowledgements in Slack command/message surfaces, with the real coaching routed into Beckett's private Slack assistant conversation when available
- User-selected content and the exact private Beckett thread, retrieved only for the active request and discarded after the response
- Tool-style agent layer for `analyze_slack_thread`, `draft_slack_reply`, `coach_for_clarity`, `prep_difficult_conversation`, `summarize_relationship_context`, and `explain_tone_without_over_inference`
- Sidebar-only guided flows for `/beckett respond`, `/beckett rewrite`, `/beckett decode`, `/beckett prep`, and `/beckett practice`; no pop-up modal intake in the hackathon demo
- Slack Messages native suggested prompts for Beckett starter actions
- Slack App Home as the Beckett History hub for recent and archived coaching conversations

## Staging Setup

Use the exact sequence in `docs/slack-staging-deployment.md`. The staging manifest is already pinned to:

- `https://beckett-git-staging-sloane-s-projects1.vercel.app`
- bot-only scopes: `commands`, `chat:write`, `assistant:write`, `im:history`, `im:write`, and `users:read`

The staging release requires the two Slack migrations, a separate staging OAuth Worker, all required Vercel secrets, and a reinstall of the staging Slack app. Account linking is optional; unlinked Slack users receive the guest allowance, while linked users share the credits from their Beckett subscription.

## Slack-Only Hackathon Test Plan

Use Slack Desktop or the Slack web app:

### 1. Basic Slack App Health

1. Run `/beckett` with no text.
   - Expected: Beckett returns a clean Slack-native help card with command examples.
   - Expected: No `operation_timeout`.
   - Expected: No visible asterisk-heavy or terminal-like formatting.
2. Run `/beckett decode "Sure, sounds fine."`.
   - Expected: Slack acknowledges quickly.
   - Expected: No pop-up or modal opens.
   - Expected: Beckett moves the coaching into the private Beckett assistant conversation when available.
   - Expected: The response uses clean section labels and short bullets.
   - Expected: No public channel message is posted.

### 1A. Beckett Suggested Prompts + Home History

1. Open Beckett in Slack and select the Messages tab.
   - Expected: Slack's native suggested prompts show `Decode a Selected Message`, `Respond to a Selected Message`, `Edit a Draft`, and `Prep`.
   - Expected: The suggested prompt title says `What can Beckett help with today?`
2. Click a selected-message suggested prompt, such as `Respond to a Selected Message`.
   - Expected: Beckett gives instructions for using the message’s `...` menu, `/beckett respond` in the source conversation, or a Slack message link.
   - Expected: The prompt sends normal assistant text, not a literal `/beckett` command.
   - Expected: No public channel message is posted.
3. Click `Edit a Draft`.
   - Expected: Beckett asks who the message is going to before asking for draft text.
4. Open the Home tab.
   - Expected: Home shows `Beckett History`.
   - Expected: Recent active and archived conversations appear.
5. Click `Continue` on a Home history card.
   - Expected: Beckett posts a private continuation message with the prior summary and next-step buttons.
6. Click `Archive conversation` inside an active Messages thread.
   - Expected: The conversation is archived.
   - Expected: Beckett posts the bottom start card with the same starter labels as the native suggested prompts.
   - Expected: The archived conversation remains visible in Home history without an Archive button.

### 2. Message Shortcut: Decode + Respond

1. In the demo workspace, open the vague manager task handoff thread.
2. Use the message shortcut: `Beckett - Decode`.
   - Expected: Beckett responds privately.
   - Expected: Beckett separates what is visible from possible interpretation.
   - Expected: Beckett does not claim the manager is annoyed, comfortable, aligned, or reacting unless that is visible in the provided Slack context.
   - Expected: Beckett separates visible facts from possible interpretation without drafting response options unless useful.
3. Use the message shortcut: `Beckett - Respond`.
   - Expected: Beckett starts a private response thread.
   - Expected: Beckett gives a concise read, a next move, and 2-3 reply options.
   - If Slack still shows only `Ask Beckett`, update and reinstall the Slack app from the current staging manifest.
4. Repeat with the passive-aggressive teammate thread.
   - Expected: Beckett helps the user avoid over-reading and gives a practical reply option.

### 3. Slash Commands: Workplace Coaching

Test these commands:

1. `/beckett respond help me answer this without sounding defensive`
2. `/beckett rewrite "Any update on this?"`
3. `/beckett decode "Sure, sounds fine."`
4. `/beckett prep I need to talk to my manager about workload in my 1:1`
5. `/beckett practice my 1:1 with my manager about workload`

Expected:
- Commands do not open pop-up modals.
- Slash command surfaces only show a tiny private acknowledgement.
- Final coaching routes to Beckett's private assistant conversation when available.
- Beckett gives neurodivergent-friendly workplace communication coaching.
- Beckett avoids clinical labels, hidden-intent claims, and overconfident reads.
- Draft options stay Slack-ready and easy to copy.

Removed modes:
- `/beckett draft`
- `/beckett clarity`
- `/beckett boundary`
- `/beckett followup`
- `/beckett tone`

Expected:
- Beckett should point users to `/beckett respond`, `/beckett rewrite`, `/beckett decode`, `/beckett prep`, or `/beckett practice`.

### 4. Sidebar Prep: Difficult Conversation Walkthrough

1. Run `/beckett prep I need to ask my manager for a raise`.
   - Expected: No `operation_timeout`.
   - Expected: Slack quickly shows a private acknowledgement.
   - Expected: No modal opens.
   - Expected: Beckett starts a private sidebar walkthrough.
2. Continue in the Beckett assistant conversation.
   - Expected: Beckett asks one focused question at a time.
   - Expected: Beckett asks who you are talking to if missing.
   - Expected: Beckett asks the desired outcome.
   - Expected: Beckett asks likely pushback/concerns.
   - Expected: Beckett uses only the content supplied in the private Beckett thread and asks for any missing evidence one focused question at a time.
3. Confirm evidence.
   - Expected: Output includes conversation goal, talking points, opening sentence, likely pushback, practice prompt, and follow-up draft.

### 4A. Sidebar Practice: Role-Play Setup

1. Run `/beckett practice my 1:1 with my manager about workload`.
   - Expected: Slack quickly shows a private acknowledgement.
   - Expected: No modal opens.
   - Expected: Beckett starts a private sidebar practice setup.
2. Continue in the Beckett assistant conversation.
   - Expected: Beckett asks who you are practicing with if missing.
   - Expected: Beckett asks what you want to get better at.
   - Expected: Beckett asks what kind of pushback to role-play.
   - Expected: Beckett starts the practice as the other person.

### 5. Sidebar / Assistant Coaching Flow

1. Open Beckett from Slack's app/sidebar area.
2. Ask: `Help me prepare to ask my manager for a raise`.
   - Expected: Beckett behaves like a coach, not a single-wall-of-text chatbot.
   - Expected: Beckett can ask focused follow-up questions one at a time when more context is needed.
   - Expected: Beckett rehydrates only the exact private Beckett thread and asks the user for any additional evidence it needs.
3. Confirm evidence behavior:
   - Expected: Beckett says it found possible supporting evidence from Slack context, not guaranteed accomplishments.
   - Expected: Beckett asks the user to confirm what to include.
   - Expected: Beckett distinguishes visible Slack facts from interpretation.
4. Continue the prep flow.
   - Expected: Beckett produces an opening line, talking points, likely pushback, and follow-up draft.

### 6. Zero-Copy Slack Context

1. Start from a message shortcut.
   - Expected: Beckett uses the selected message transiently and does not copy it into Beckett storage.
2. Continue in the private Beckett DM thread.
   - Expected: Beckett re-reads that exact Slack-owned thread for the active request and then discards the reconstructed transcript.
3. Ask about a person or project that is not present in the selected message or Beckett thread.
   - Expected: Beckett asks for context instead of searching the workspace or inventing evidence.
4. Inspect the database after the flows.
   - Expected: only opaque IDs, flow state, installation credentials, and content-free credit/usage metadata exist; no prompts, messages, responses, titles, or summaries are stored.

### 7. Privacy + Guardrail Checks

1. Confirm Beckett responses are private/ephemeral by default.
2. Confirm Beckett does not post into the channel automatically.
3. Confirm Beckett does not store Slack messages, prompts, generated responses, thread transcripts, content-derived titles, or summaries.
4. Confirm Beckett does not infer diagnosis or hidden intent.
5. Confirm Beckett never says someone reacted, agreed, felt comfortable, was annoyed, or pushed back unless visible in retrieved Slack context.
6. Confirm no Chrome extension, Gmail, courses, website dashboard, or beta-signup features are shown in the hackathon demo.

### 8. Reviewer Access

1. Confirm the Slack app is installed and working in the sandbox workspace.
2. Confirm `slackhack@salesforce.com` and `testing@devpost.com` have access before submission.
3. Confirm demo workspace threads are populated with non-sensitive test data.
4. Confirm the Devpost submission includes:
   - Slack sandbox URL
   - Demo video under 3 minutes
   - Architecture diagram
   - Slack-only product description
   - Track: Slack Agent for Good

## Hackathon Demo Story

1. A user sees a vague manager Slack thread before a 1:1.
2. The user clicks `Beckett - Respond`.
3. Beckett explains what is visible, what is uncertain, and what not to over-read.
4. Beckett suggests the next move and 2-3 private reply options.
5. The user runs `/beckett prep I need to talk to my manager about workload in my 1:1`.
6. Beckett starts a private sidebar walkthrough.
7. Beckett asks one focused question at a time.
8. Beckett stays within the selected message and exact private Slack thread. If more evidence is needed, the user supplies it in Slack.

Closing line: Beckett helps neurodivergent workers communicate clearly inside the tools where work already happens.

## Production Notes

- Do not reuse staging Slack app secrets in production.
- Keep the hackathon submission Slack-only. Do not include Chrome extension, Gmail, courses, beta signup, or web dashboard flows in the demo.
- Slack requires command and shortcut requests to be acknowledged quickly. These endpoints keep responses concise, but a future queue/background job would make longer AI responses more resilient.
- Slack Agent/Split View features require the **Agents** feature to be enabled in Slack app settings and may require reinstalling the app after the manifest adds agent scopes/events.
- The zero-copy launch intentionally excludes Real-Time Search, workspace-wide history scopes, and user OAuth tokens. Requesting broader access later requires a new privacy and scope review, Slack re-review, and customer reauthorization.
