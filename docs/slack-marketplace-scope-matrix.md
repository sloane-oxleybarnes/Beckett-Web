# Beckett Slack launch scope matrix

The zero-copy launch uses bot scopes only. It does not request user tokens, workspace-wide search, private-channel history, public-channel history, group-DM history, or legacy `search:read` scopes.

| Product behavior | Slack API methods / entry point | Launch scope | Why it is needed |
|---|---|---|---|
| `/beckett` | Slash command request | `commands` | Receives user-invoked commands. |
| Private coaching replies and cleanup | `chat.postMessage`, `chat.delete`, `chat.scheduleMessage`, `chat.deleteScheduledMessage`, `chat.getPermalink` | `chat:write` | Posts only Beckett-authored content, manages inactivity cards, and navigates back to Slack-owned threads. |
| Messages/agent surface | `assistant.threads.setStatus`, `assistant.threads.setTitle`, `assistant.threads.setSuggestedPrompts` | `assistant:write` | Configures and updates Beckett's Slack agent thread. |
| Open Beckett DM | `conversations.open` | `im:write` | Opens the user's private Beckett conversation. |
| Rehydrate an exact Beckett DM thread | `conversations.history`, `conversations.replies` | `im:history` | Re-reads the Slack-owned thread on every continuation; no transcript is copied to Beckett storage. |
| Resolve display names | `users.info` | `users:read` | Uses Slack identity in private coaching without storing profile content. |
| App Home | `views.publish`, `app_home_opened` | covered by the bot installation and event subscription | Publishes generic metadata-only history and credit status. |
| Installation lifecycle | OAuth v2, `app_uninstalled`, `tokens_revoked` | no additional content scope | Installs, rotates, revokes, and removes encrypted workspace credentials. |

## Explicitly excluded at launch

- `channels:history`, `groups:history`, and `mpim:history`
- all `search:read*` scopes
- `assistant.search.context`, `assistant.search.info`, and `search.messages` execution paths
- user OAuth scopes and user access tokens

Code keeps broad-search helpers quarantined for later evaluation, but the public entry point returns `feature_not_enabled` before any search call. Adding any broader retrieval feature requires a staging app, an updated method-to-scope inventory, privacy review, Marketplace re-review, and customer reauthorization.

References: [Slack Marketplace review guide](https://docs.slack.dev/slack-marketplace/distributing-your-app-in-the-slack-marketplace/), [OAuth v2](https://docs.slack.dev/authentication/installing-with-oauth/), [token rotation](https://docs.slack.dev/authentication/using-token-rotation/).
