# Beckett for Slack Zero-Copy Data Contract

Status: implementation contract for the standalone Beckett Slack app.

## Product boundary

Beckett for Slack operates inside Slack. Slack is the system of record for Slack messages and coaching threads. Beckett may retrieve Slack content for a user-initiated request, process it transiently, post the result back to Slack, and then discard the content.

The Beckett website supports installation, account linking, subscriptions, billing, privacy, and support. The Chrome extension is not a Slack product surface.

## Core rules

1. Do not durably store Slack message text, thread transcripts, search results, channel names, participant names, user prompts, generated coaching responses, or content-derived summaries and titles.
2. Do not use Slack content to update Beckett contacts, relationship memory, CRM records, analytics, training data, or product telemetry.
3. Treat Slack request payloads, reconstructed threads, AI prompts, and AI responses as transient request data.
4. Persist only fields in the durable metadata allowlist below.
5. Slack-scoped logs and error telemetry must pass through the zero-copy scrubber. Raw Slack payloads and AI request/response bodies must never be logged.
6. OAuth credentials are durable secrets, not telemetry. Store only encrypted tokens in the installation store and never include them in logs, analytics, or general metadata.
7. Slack retries must use content-free request identifiers for idempotency. A successful user-visible response may create a content-free credit event.

## Durable metadata allowlist

The interaction metadata layer may store only:

- `slackTeamId`
- `slackUserId`
- `beckettUserId`
- `slackChannelId`
- `slackThreadTs`
- `slackMessageTs`
- `slackSourceChannelId`
- `slackSourceThreadTs`
- `slackSourceMessageTs`
- `flowType`
- `currentStep`
- `status`
- `grantedScopes`
- `creditsCharged`
- `requestId`
- `eventType`
- `success`
- `errorCode`
- `latencyMs`
- `occurredAt`
- `searchAvailable`
- `expiresAt`

Identifiers are opaque routing metadata. They must not be resolved into durable display names.

Installation storage may additionally contain encrypted access and refresh tokens, token expiry, installation timestamps, and Slack app/workspace identifiers. Installation secrets must use a dedicated encrypted storage type and must not pass through the interaction metadata or telemetry APIs.

## Transient request data

The following may exist only for the duration of a user-initiated request:

- Selected Slack message text and blocks
- Slack thread messages and attachments
- Real-time Search queries and results
- Channel, participant, and author display names
- User prompts and guided-flow answers
- Prep evidence and practice responses
- AI system/user prompts containing Slack context
- Generated coaching responses
- Content-derived titles, summaries, labels, or relationship insights

Transient data may be sent to an approved AI processor only to produce the immediate user-visible response under Beckett's processor, retention, and no-training requirements.

## Subscription and credit data

Zero-copy does not prevent Beckett from enforcing subscriptions or daily credits. Beckett may store Slack identity mappings, Beckett account links, plan entitlements, credit reservations, content-free usage events, reset timestamps, and billing identifiers.

A usage event may identify the feature (for example `decode` or `prep`), credit amount, request identifier, success state, and timestamp. It must not contain the user's input, generated output, Slack channel name, participant name, or a description derived from the conversation.

## Multi-turn flows

Slack threads are the transcript of record. Durable flow state may record the Slack thread reference, flow type, current step, and status. On each turn, Beckett rehydrates the authorized Slack thread in memory, generates the next response, posts it to Slack, and discards the reconstructed context.

App Home history may display generic metadata labels such as `Prep · Today`. It must not display a title or summary derived from stored Slack content.

## Observability

Slack-scoped telemetry uses an allowlist. Unknown fields are filtered. Request bodies, prompts, messages, transcripts, search queries/results, responses, blocks, attachments, tokens, cookies, authorization headers, channel names, participant names, and exception payloads that may contain content are filtered.

Permitted observability includes opaque Slack IDs, feature/flow type, content-free status and error codes, credit amount, latency, success state, scope names, search availability, and timestamps.

## Historical data migration

Historical deletion is intentionally outside Step 1. Before deletion, later implementation steps must stop all content writes, remove runtime reads from content tables, validate live thread rehydration, inventory every Slack-related table/log/backup, and obtain explicit approval for the destructive purge.

## Enforcement

`lib/slack-zero-copy.ts` defines the shared durable/transient types, validates durable interaction metadata, and scrubs Slack telemetry. Tests must fail when a caller attempts to add Slack content fields to durable metadata or Slack-scoped telemetry.
