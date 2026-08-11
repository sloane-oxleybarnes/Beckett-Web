import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSlackFlowSessionRow,
  buildSlackUsageEventRow,
  createSlackDurableInteractionMetadata,
  scrubSlackTelemetry,
  SLACK_ZERO_COPY_FILTERED,
  SlackZeroCopyViolationError,
} from "../lib/slack-zero-copy.ts";

test("Slack durable metadata accepts only content-free operational fields", () => {
  const metadata = createSlackDurableInteractionMetadata({
    slackTeamId: "T123",
    slackUserId: "U123",
    slackChannelId: "D123",
    slackThreadTs: "1720000000.000100",
    flowType: "prep",
    currentStep: "desired_outcome",
    status: "active",
    creditsCharged: 1,
    requestId: "Ev123",
    eventType: "slack_response_completed",
    success: true,
    latencyMs: 250,
    occurredAt: "2026-08-10T20:00:00.000Z",
  });

  assert.equal(metadata.flowType, "prep");
  assert.equal(Object.isFrozen(metadata), true);
});

for (const forbiddenField of [
  "prompt",
  "messageText",
  "transcript",
  "summary",
  "title",
  "channelName",
  "participantNames",
  "generatedResponse",
]) {
  test(`Slack durable metadata rejects ${forbiddenField}`, () => {
    assert.throws(
      () => createSlackDurableInteractionMetadata({
        slackTeamId: "T123",
        slackUserId: "U123",
        [forbiddenField]: "private Slack content",
      }),
      SlackZeroCopyViolationError
    );
  });
}

test("Slack telemetry preserves allowlisted metadata and filters content and tokens", () => {
  const scrubbed = scrubSlackTelemetry({
    slackTeamId: "T123",
    slackUserId: "U123",
    flowType: "decode",
    success: true,
    latencyMs: 125,
    prompt: "Please decode this private message",
    response: "Private model response",
    accessToken: "xoxp-secret",
    nested: { message: "Private nested message" },
    errorCode: "Morgan said the deadline is impossible",
  });

  assert.deepEqual(scrubbed, {
    slackTeamId: "T123",
    slackUserId: "U123",
    flowType: "decode",
    success: true,
    latencyMs: 125,
    prompt: SLACK_ZERO_COPY_FILTERED,
    response: SLACK_ZERO_COPY_FILTERED,
    accessToken: SLACK_ZERO_COPY_FILTERED,
    nested: SLACK_ZERO_COPY_FILTERED,
    errorCode: SLACK_ZERO_COPY_FILTERED,
  });
});

test("Slack durable metadata rejects content smuggled through a code field", () => {
  assert.throws(
    () => createSlackDurableInteractionMetadata({
      slackTeamId: "T123",
      slackUserId: "U123",
      errorCode: "Morgan said the deadline is impossible",
    }),
    SlackZeroCopyViolationError
  );
});

test("Slack flow rows contain references and state, never conversation content", () => {
  const row = buildSlackFlowSessionRow({
    slackTeamId: "T123",
    slackUserId: "U123",
    beckettUserId: "9cfa4f37-1d70-4eb0-ae4c-d47b22cb2c25",
    slackChannelId: "D123",
    slackThreadTs: "1720000000.000100",
    slackSourceChannelId: "C456",
    slackSourceMessageTs: "1720000000.000050",
    flowType: "respond",
    currentStep: "draft_review",
    status: "active",
    expiresAt: "2026-08-11T20:00:00.000Z",
  });

  assert.deepEqual(Object.keys(row).sort(), [
    "beckett_user_id",
    "current_step",
    "expires_at",
    "flow_type",
    "request_id",
    "slack_channel_id",
    "slack_message_ts",
    "slack_source_channel_id",
    "slack_source_message_ts",
    "slack_source_thread_ts",
    "slack_team_id",
    "slack_thread_ts",
    "slack_user_id",
    "status",
    "updated_at",
  ]);
});

test("Slack usage rows charge credits without retaining prompts or response metadata", () => {
  const row = buildSlackUsageEventRow({
    slackTeamId: "T123",
    slackUserId: "U123",
    eventType: "guest_slash_command",
    flowType: "decode",
    creditsCharged: 1,
    success: true,
  });

  assert.equal(row.credits_charged, 1);
  assert.equal(row.event_type, "guest_slash_command");
  assert.equal("metadata" in row, false);
  assert.equal("prompt" in row, false);
  assert.equal("response" in row, false);
});

test("Slack zero-copy session and usage tables expose no conversation-content columns", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260810213000_slack_zero_copy_foundation.sql", import.meta.url),
    "utf8"
  );
  const flowTable = migration.match(/create table if not exists public\.slack_flow_sessions \(([\s\S]*?)\n\);/)?.[1] || "";
  const usageTable = migration.match(/create table if not exists public\.slack_usage_events \(([\s\S]*?)\n\);/)?.[1] || "";

  assert.ok(flowTable);
  assert.ok(usageTable);
  for (const forbiddenColumn of [
    "prompt",
    "content",
    "transcript",
    "summary",
    "title",
    "channel_name",
    "answers",
    "metadata",
  ]) {
    assert.doesNotMatch(flowTable, new RegExp(`\\b${forbiddenColumn}\\b`, "i"));
    assert.doesNotMatch(usageTable, new RegExp(`\\b${forbiddenColumn}\\b`, "i"));
  }
});

test("Slack credit reservations are idempotent and charge only on commit", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260811090000_slack_credit_reservations.sql", import.meta.url),
    "utf8"
  );
  assert.match(migration, /unique \(slack_team_id, slack_user_id, request_id\)/);
  assert.match(migration, /status = 'reserved'/);
  assert.match(migration, /create or replace function public\.commit_slack_credit/);
  assert.match(migration, /insert into public\.web_credit_events/);
  assert.match(migration, /insert into public\.slack_usage_events/);
  assert.match(migration, /create or replace function public\.release_slack_credit/);
  assert.doesNotMatch(migration, /security definer/i);
  assert.equal((migration.match(/security invoker/gi) || []).length, 3);
});

test("Slack launch manifest requests only the reviewed bot scopes", () => {
  const manifest = JSON.parse(readFileSync(new URL("../docs/slack-app-manifest-staging.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.oauth_config.scopes.bot.sort(), [
    "assistant:write", "chat:write", "commands", "im:history", "im:write", "users:read",
  ]);
  assert.equal("user" in manifest.oauth_config.scopes, false);
  assert.equal(manifest.settings.token_rotation_enabled, true);
  assert.ok(manifest.settings.event_subscriptions.bot_events.includes("app_uninstalled"));
  assert.ok(manifest.settings.event_subscriptions.bot_events.includes("tokens_revoked"));
});

test("Slack OAuth worker and staging manifest use the same reviewed scopes and origin", () => {
  const manifest = JSON.parse(readFileSync(new URL("../docs/slack-app-manifest-staging.json", import.meta.url), "utf8"));
  const worker = readFileSync(new URL("../workers/slack-oauth.js", import.meta.url), "utf8");
  const workerScopes = worker.match(/const BOT_SCOPES = "([^"]+)"/)?.[1].split(",").sort();
  assert.deepEqual(workerScopes, manifest.oauth_config.scopes.bot.sort());

  const stagingOrigin = "https://beckett-git-staging-sloane-s-projects1.vercel.app";
  assert.equal(new URL(manifest.features.slash_commands[0].url).origin, stagingOrigin);
  assert.equal(new URL(manifest.oauth_config.redirect_urls[0]).origin, stagingOrigin);
  assert.equal(new URL(manifest.settings.event_subscriptions.request_url).origin, stagingOrigin);
  assert.equal(new URL(manifest.settings.interactivity.request_url).origin, stagingOrigin);
});

test("Chrome extension package configuration contains no Slack surface", () => {
  const manifest = readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8");
  const packager = readFileSync(new URL("../scripts/package-extension.js", import.meta.url), "utf8");
  const background = readFileSync(new URL("../extension/background/service_worker.js", import.meta.url), "utf8");
  assert.doesNotMatch(manifest, /slack/i);
  assert.doesNotMatch(packager, /slack/i);
  assert.doesNotMatch(background, /slack/i);
});
