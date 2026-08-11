# Beckett for Slack Hackathon Submission Draft

## Track

Primary: Slack Agent for Good  
Backup: New Slack Agent

## One-Line Pitch

Beckett for Slack prepares neurodivergent workers for the conversations that matter at work.

## Description

Beckett for Slack is a private workplace communication coach built for Slack. It helps neurodivergent professionals decode confusing Slack threads, avoid over-reading ambiguous tone, draft replies that match their intent, and prepare for difficult conversations before they happen.

Instead of acting like a generic chatbot or writing assistant, Beckett guides the user through conversation strategy: what is visible, what is uncertain, what the next step should be, and how to say it clearly. Responses are private by default. In the zero-copy version, Beckett processes a selected message or the exact private Beckett thread only for the active request, posts the result back to Slack, and does not persist the conversation content.

This hackathon submission is Slack-only. It does not rely on Beckett's Chrome extension, Gmail integration, courses, website dashboard, or beta signup flow.

## Demo Workflow

1. The user sees a vague manager Slack message before a 1:1.
2. The user opens the message shortcut and chooses `Beckett - Decode` or `Beckett - Respond`.
3. For decode, Beckett explains what is visible in the thread, what is only a possible interpretation, and what not to over-read.
4. For respond, Beckett suggests a next step and 2-3 reply options: Direct but kind, Warm and collaborative, and Concise.
5. The user runs `/beckett prep I need to talk to my manager about workload in my 1:1`.
6. Beckett starts a private sidebar walkthrough instead of opening a modal.
7. Beckett asks one focused setup question at a time.
8. Beckett rehydrates the exact private Slack thread and asks for any missing evidence one focused question at a time.
9. Beckett builds talking points, an opening line, likely pushback, a practice prompt, and a follow-up draft from the context the user supplied in Slack.

## Demo Workspace Threads

### Vague Manager Task Handoff

Priya: Can you clean up the onboarding flow before Friday?  
Priya: Nothing huge, just make it easier for the review.

User asks Beckett: What does she actually want from me here?

### Passive-Aggressive Teammate Thread

Morgan: I guess I can take another pass at the deck if that helps.  
Morgan: I just thought we were already aligned on the direction.

User asks Beckett: Is Morgan annoyed or am I overthinking this?

### Boundary/Workload 1:1

Nick: Can you also take on the vendor follow-up this week?  
Nick: I know you have a lot, but it should be quick.

User asks Beckett: Help me prep for my 1:1. I need to say I cannot take this on without sounding difficult.

### Feedback Response

Claire: The client email was clear, but next time I need you to flag risk earlier.  
Claire: We were too close to the deadline to adjust.

User asks Beckett: Help me respond without sounding defensive.

## Architecture Diagram

```mermaid
flowchart LR
  A["Slack message shortcut or /beckett command"] --> B["Next.js Slack endpoint"]
  B --> C["Slack request signature verification"]
  C --> D["Encrypted workspace installation lookup"]
  D --> H["Selected message or exact Beckett DM thread"]
  H --> F["Slack agent tool selector"]
  F --> G["Anthropic coaching call with Beckett guardrails"]
  G --> I["Slack Agent/Split View coach panel"]
  B --> J["Content-free flow and credit metadata"]
  J --> H
  G --> K["Private ephemeral acknowledgement"]
```

## Privacy Notes

- Beckett responds privately by default.
- Beckett does not post into the channel unless the user chooses to copy or send wording.
- Beckett does not store Slack messages, prompts, generated responses, transcripts, or content-derived titles and summaries.
- Slack remains the transcript system of record; Beckett retains only encrypted installation credentials, opaque routing/flow state, optional account links, and content-free credit and usage events.
- Beckett separates visible evidence from possible interpretation.
- Beckett does not infer diagnosis or hidden intent.
- Guided sidebar answers remain in the Slack-owned thread and are re-read transiently only when the user continues that flow.

## Demo Script

Opening: "Beckett for Slack is a neurodivergent workplace communication coach. It helps people prepare for high-stakes conversations, understand ambiguous tone, and respond clearly without over-apologizing or spiraling."

Demo:
1. Show the vague manager thread.
2. Click `Beckett - Respond`.
3. Highlight that Beckett names visible evidence and uncertainty separately.
4. Show reply options.
5. Run `/beckett prep I need to talk to my manager about workload in my 1:1`.
6. Show Beckett starting the prep in the Slack Agent/Split View panel.
7. Show Beckett asking one focused question at a time.
8. Show Beckett using the exact private thread and asking for one missing piece of evidence.
9. Show the user supplying that evidence in Slack.
10. Show talking points, opening line, likely pushback, practice prompt, and follow-up draft.

Close: "Beckett for Slack helps neurodivergent workers communicate clearly inside the tool where work already happens."

## Slack-Only Test Checklist

- `/beckett` returns a clean help card with no timeout.
- `/beckett decode "Sure, sounds fine."` routes coaching into Beckett's Slack assistant conversation without opening a modal.
- `/beckett respond`, `/beckett rewrite`, `/beckett decode`, `/beckett prep`, and `/beckett practice` are the only visible slash subcommands.
- `/beckett draft`, `/beckett clarity`, `/beckett boundary`, `/beckett followup`, and `/beckett tone` return a clean unsupported/help response.
- `Beckett - Decode` message shortcut returns a private response that separates visible facts from possible interpretation.
- `Beckett - Respond` message shortcut returns private draft options for the selected message.
- Unlinked Slack users receive five successful coaching responses per UTC day across Decode, Respond, Rewrite, Prep, and Practice.
- Linked Slack users share their Beckett subscription's daily credit allowance; linking remains optional.
- `/beckett prep I need to ask my manager for a raise` starts a private guided sidebar flow without opening a modal.
- Prep output appears privately in Slack.
- Sidebar assistant flow asks focused follow-up questions instead of producing only one long wall of text when more context is needed.
- Beckett never searches the wider workspace in the zero-copy launch and requests missing context from the user.
- A cold/serverless continuation rehydrates only the exact Slack-owned Beckett thread.
- Beckett does not hallucinate reactions, agreement, annoyance, rapport, or hidden intent.
- Beckett does not post publicly by default.
- Demo excludes Chrome extension, Gmail, courses, website dashboard, and beta signup.
