# Slack zero-copy Phase 10 purge runbook

Status: prepared, not approved, not executed.

This is a separate destructive production deployment. Do not run it merely because the zero-copy application code or migrations are deployed.

## Required gates

1. Deploy `slack_installations`, `slack_user_links`, `slack_flow_sessions`, `slack_flow_bot_messages`, `slack_usage_events`, and `slack_credit_reservations` in staging.
2. Confirm every Slack flow rehydrates from the exact Slack thread after a cold/serverless restart.
3. Confirm Decode, Respond, Rewrite, Prep, Practice, App Home continuation/archive, installation, account linking, token rotation, uninstall, and daily credit reset end to end.
4. Confirm failed AI calls and rejected Slack posts release their reservation; only Slack-accepted responses commit one credit.
5. Run the runtime scan and confirm there are no reads or writes of content columns listed below.
6. Inspect production logs, Sentry payloads, analytics, support exports, database replicas, and backups for Slack content.
7. Tell pilot users what will be deleted, the cutoff time, and that Slack becomes the only transcript system of record.
8. Obtain explicit written approval naming production and the purge timestamp.

## Legacy content inventory

| Store | Content-bearing fields / risk | Purge action after approval |
|---|---|---|
| `slack_coaching_messages` | `content` and full user/Beckett transcript rows | Delete all rows. |
| `slack_coaching_threads` | `title`, `summary`, `prompt_snippet`, `source_channel_name` | Null content fields, then delete legacy rows after reference migration. |
| `slack_guest_sessions` | `source`, `state`, `artifacts`, `transcript` JSON | Delete all rows. |
| `slack_guest_usage_events` | legacy `metadata` may contain selected messages, guided answers, and transcripts | Delete content-bearing rows; retain only independently verified content-free aggregates if required. |
| `slack_agent_sessions` | historical `answers`, `evidence_suggestions`, `confirmed_evidence` | Replace with empty JSON/arrays; later drop content columns. |
| `slack_pending_requests` | `prompt`, `response_url`, `slack_channel_name` | Delete expired/all legacy rows; remove the content-based path before purge. |
| `slack_command_jobs` | inspect payload/error JSON for command text or response URLs | Delete content-bearing jobs and redesign/remove payload retention. |
| logs / analytics / error reporting | prompts, response bodies, Slack event payloads, search output | Purge per provider tooling and verify scrubbers. |
| backups / replicas / exports | copies of every store above | Apply provider retention deletion or document immutable expiry date. |

## Runtime scan

Run before approval and again against the exact release commit:

```sh
rg -n 'slack_coaching_messages|slack_coaching_threads|slack_guest_sessions|slack_guest_usage_events|slack_pending_requests|answers|evidence_suggestions|confirmed_evidence|transcript|prompt_snippet' app/api/slack lib/slack-*.ts
```

Any content read/write is a failed gate. References used only by a separately approved purge utility must live outside runtime application paths.

## Execution policy

The actual purge SQL is intentionally not a normal Supabase migration. Create and review a timestamped, transaction-wrapped operations script only after approval. Start with counts and sampled schema metadata (never sample message content), take the approved backup-retention action, run the purge, verify zero rows/null columns, and record the operator, timestamp, row counts, and backup expiry. Column drops occur in a later migration after a clean observation window.

## Rollback boundary

Application rollout can be rolled back. Deleted Slack coaching content cannot be restored unless an approved backup is deliberately retained, which would itself extend content retention. That tradeoff must be decided in the Phase 10 approval.
