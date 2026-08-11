# Beckett Chrome Web Store Listing Draft

## Store listing

**Name:** Beckett

**Short description:** Workplace communication coaching for Gmail.

**Category:** Productivity

**Language:** English

**Support contact:** hello@meetbeckett.co

**Privacy policy URL:** https://meetbeckett.co/privacy

## Full description

Beckett is a workplace communication coach for neurodivergent professionals. During beta, Beckett helps you understand confusing Gmail messages, draft clearer replies, and practice what to say before you send.

Beckett works from a browser side panel. You stay in control: analysis only happens when you ask Beckett to analyze the current message or when you turn on an analysis setting yourself. Beckett sends the relevant conversation context to Beckett's backend to generate coaching responses and enforce beta usage limits.

Beta features:

- Analyze Gmail conversations for tone, context, and likely next steps.
- Draft replies in a direct, kind, professional voice.
- Ask follow-up questions about the visible conversation.
- Practice difficult workplace conversations.
- Connect your Beckett account so beta access and rate limits work across the web app and extension.

Beckett is currently focused on workplace communication. Google Meet, Zoom, calendar support, mobile overlays, and broader personal integrations are planned for later versions.

## Single purpose

Beckett provides workplace communication coaching inside Gmail for beta users.

## Permission justifications

**storage:** Saves Beckett login state, extension preferences, Gmail connection metadata, and local settings so users do not have to reconnect every time.

**identity:** Allows users to log in with Beckett and connect Gmail through Google OAuth.

**sidePanel:** Opens Beckett's coaching panel next to Gmail.

**tabs:** Detects when the active tab is Gmail and opens or updates Beckett's side panel for that page.

**activeTab:** Lets Beckett work with the current Gmail tab when the user opens the extension or asks for coaching.

**scripting:** Injects the Gmail reader script when needed so Beckett can read the current visible conversation after the user asks for coaching.

## Host permission justifications

**https://mail.google.com/***: Lets Beckett read the current Gmail conversation in the browser when the user asks for analysis or drafting help.

**https://meetbeckett.co/*** and **https://www.meetbeckett.co/***: Connects the extension to the user's Beckett account, settings, beta limits, and AI analysis API.

**https://gmail.googleapis.com/***: Allows Beckett to fetch full Gmail thread context after the user connects Gmail, including collapsed thread messages that are not visible on screen.

## Data use answers

Beckett reads Gmail message content only when the user requests analysis/drafting or enables an analysis setting. Beckett does not read messages continuously in the background.

Beckett stores account and usage metadata needed for beta access, rate limits, analytics, debugging, and support. Beckett does not store full Gmail message history by default.

If a user submits feedback, the feedback/debug report may include message content so the Beckett team can investigate the issue. Users should only submit feedback when they are comfortable sharing that context.

Beckett does not sell user data. Beckett does not use Gmail content for advertising.

## Screenshots to prepare

1. Extension side panel logged in on Gmail with analysis controls visible.
2. Gmail analysis result with message content blurred or sample/test content.
3. Draft-from-scratch or practice flow, using sample/test content.
4. Settings/account connection state showing Beckett and Gmail connected.
