# Beckett Chrome Web Store Listing Draft

## Store listing

**Name:** Beckett

**Short description:** Workplace communication coaching for Slack and supported non-email work pages.

**Category:** Productivity

**Language:** English

**Support contact:** hello@meetbeckett.co

**Privacy policy URL:** https://meetbeckett.co/privacy

## Full description

Beckett is a workplace communication coach for neurodivergent professionals. During beta, the Chrome extension supports user-invoked coaching on supported non-email work pages. Gmail coaching is available separately through Beckett's native Google Workspace add-on.

Beckett works from a browser side panel. You stay in control: analysis only happens when you ask Beckett to analyze the current message or when you turn on an analysis setting yourself. Beckett sends the relevant conversation context to Beckett's backend to generate coaching responses and enforce beta usage limits.

Beta features:

- Analyze supported Slack and non-email work conversations for tone, context, and likely next steps.
- Draft replies in a direct, kind, professional voice.
- Ask follow-up questions about the visible conversation.
- Practice difficult workplace conversations.
- Connect your Beckett account so beta access and rate limits work across the web app and extension.

Beckett is currently focused on workplace communication. Google Meet, Zoom, calendar support, mobile overlays, and broader personal integrations are planned for later versions.

## Single purpose

Beckett provides user-invoked workplace communication coaching on supported non-email browser pages.

## Permission justifications

**storage:** Saves Beckett login state, extension preferences, Slack connection metadata, and local settings so users do not have to reconnect every time.

**identity:** Allows users to log in with Beckett and connect Slack through Slack OAuth.

**sidePanel:** Opens Beckett's coaching panel next to supported work pages.

**tabs:** Detects when the active tab is a supported work page and opens or updates Beckett's side panel for that page.

**activeTab:** Lets Beckett work with the current supported tab when the user opens the extension or asks for coaching.

**scripting:** Injects a supported-page reader script when needed so Beckett can read the current visible conversation after the user asks for coaching.

## Host permission justifications

**https://app.slack.com/***: Lets Beckett read the current Slack conversation in the browser when the user asks for analysis or drafting help.

**https://meetbeckett.co/*** and **https://www.meetbeckett.co/***: Connects the extension to the user's Beckett account, settings, beta limits, and AI analysis API.

**https://slack.com/api/***: Allows Beckett to fetch Slack thread context after the user connects Slack.

**https://lumen-slack.sloane-oxleyhase.workers.dev/***: Handles Slack OAuth token exchange without exposing Slack client secrets in the extension.

## Data use answers

Beckett reads supported-page message content only when the user requests analysis or drafting. Beckett does not read messages continuously in the background.

Beckett stores account and usage metadata needed for beta access, rate limits, analytics, debugging, and support. Beckett does not store full message history by default.

If a user submits feedback, the feedback/debug report may include message content so the Beckett team can investigate the issue. Users should only submit feedback when they are comfortable sharing that context.

Beckett does not sell user data or use message content for advertising.

## Screenshots to prepare

1. Extension side panel logged in on a supported page with analysis controls visible.
2. Slack side panel with analyze controls visible.
3. Draft-from-scratch or practice flow, using sample/test content.
4. Beckett account connection state.
