# Beckett for Microsoft Teams — message-action MVP

This prototype adds two user-invoked actions to the **More actions** menu on a Microsoft Teams message:

- **Decode with Beckett** — opens a private dialog with a cautious interpretation, visible evidence, uncertainty, and a next move.
- **Draft a response** — opens a private dialog with three editable, copyable options.

## Product boundary

The prototype receives only the message the user explicitly selects. It does not request Microsoft Graph chat-history scopes, search channels, read surrounding messages, inspect attachments, monitor conversations, capture meetings, or send messages. Generated drafts remain private until the user copies, edits, and sends one.

Selected text is never written to Beckett's database, analytics metadata, product logs, or the dialog URL. The authenticated bot endpoint encrypts the selected text into a five-minute action token placed in the URL fragment. Fragments are not sent in the initial HTTP request; the dialog removes the fragment immediately and submits the encrypted token directly to the coaching endpoint.

The selected text is sent to Beckett's configured AI provider only to generate the requested result; it is not used to train generalized models. The first rollout is single-tenant: the activity tenant must match `MICROSOFT_TEAMS_TENANT_ID`.

## Required configuration

Create a dedicated Microsoft Teams bot registration and enable the Microsoft Teams channel. Point its messaging endpoint to:

```text
https://www.meetbeckett.co/api/teams/messages
```

Configure these deployment variables:

```text
MICROSOFT_TEAMS_APP_ID
MICROSOFT_TEAMS_APP_SECRET
MICROSOFT_TEAMS_TENANT_ID
MICROSOFT_TEAMS_ACTION_TOKEN_KEY
```

`MICROSOFT_TEAMS_ACTION_TOKEN_KEY` must be a dedicated random 32-byte key encoded as base64, or a 64-character hexadecimal key. Do not reuse the Microsoft OAuth token key.

The Teams user must already have connected the same Microsoft account to Beckett. The Teams `aadObjectId` is matched to the existing Microsoft integration; the MVP requests no additional delegated Graph scopes.

## Package and sideload

After the bot is registered:

```bash
MICROSOFT_TEAMS_APP_ID=<registered-guid> npm run package:teams
```

Upload `teams-app/beckett-teams.zip` through **Teams → Apps → Manage your apps → Upload a custom app**. Tenant sideloading must be enabled. The zip contains `manifest.json`, `color.png`, and `outline.png` at its root.

## Real-client validation

- Run both actions from a one-to-one chat, group chat, and channel message.
- Confirm the dialog is visible only to the invoking user.
- Confirm an unconnected Microsoft account sees the connection prompt.
- Confirm selected HTML and plain-text messages normalize correctly.
- Confirm no message content appears in Vercel, Sentry, analytics, or database records.
- Confirm each draft must be manually copied, edited, and sent.
- Measure action-open latency and coaching latency separately.
