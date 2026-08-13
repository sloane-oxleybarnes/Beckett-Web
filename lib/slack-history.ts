import { slackRepository } from "@/lib/repositories/slack-repository";
import {
  buildBeckettPayload,
  fetchSlackConversationContext,
  fetchSlackThreadSnapshot,
  slackApiPost,
  SlackBlock,
  SlackConnectedUser,
} from "@/lib/slack-app";
import {
  rehydrateSlackGuestPrepFromTurns,
  withoutLatestSlackUserTurn,
  type SlackThreadTurn,
} from "@/lib/slack-thread-rehydration";
import { shouldScheduleSlackInactivityStartCard } from "@/lib/slack-inactivity-policy";
import {
  findSlackZeroCopyFlowSession,
  findSlackZeroCopyFlowSessionByThreadReference,
  listSlackZeroCopyBotMessages,
  listSlackZeroCopyFlowSessions,
  loadSlackZeroCopyFlowSession,
  markSlackZeroCopyBotMessageDeleted,
  normalizeSlackZeroCopyFlowType,
  recordSlackZeroCopyBotMessage,
  updateSlackZeroCopyFlowSession,
  upsertSlackZeroCopyFlowSession,
  type SlackZeroCopyFlowSession,
} from "@/lib/slack-zero-copy-store";
import { metering } from "@/lib/metering";

export const SLACK_HISTORY_CONTINUE_ACTION_ID = "beckett_history_continue";
export const SLACK_HISTORY_ARCHIVE_ACTION_ID = "beckett_history_archive";
export const SLACK_HISTORY_QUICK_ACTION_ID = "beckett_history_quick";
export const SLACK_HISTORY_EXPLAIN_MORE_ACTION_ID = "beckett_history_explain_more";
export const SLACK_HISTORY_SETTINGS_ACTION_ID = "beckett_history_settings";
const requestedSlackInactivityDelay = Number(process.env.SLACK_INACTIVITY_START_CARD_DELAY_MS || 5 * 60 * 1000);
const allowShortSlackTimer = process.env.SLACK_ALLOW_SHORT_INACTIVITY_TIMER === "true" && process.env.NODE_ENV !== "production";
export const SLACK_INACTIVITY_START_CARD_DELAY_MS = allowShortSlackTimer
  ? Math.max(1_000, Number.isFinite(requestedSlackInactivityDelay) ? requestedSlackInactivityDelay : 5 * 60 * 1000)
  : Math.max(5 * 60 * 1000, Number.isFinite(requestedSlackInactivityDelay) ? requestedSlackInactivityDelay : 5 * 60 * 1000);

const slackInactivityRuntime = globalThis as typeof globalThis & {
  beckettSlackScheduledMessages?: Map<string, string>;
};
const beckettSlackScheduledMessages =
  slackInactivityRuntime.beckettSlackScheduledMessages || new Map<string, string>();
slackInactivityRuntime.beckettSlackScheduledMessages = beckettSlackScheduledMessages;

export type SlackHistoryFlowType = "respond" | "rewrite" | "decode" | "relationship" | "prep" | "practice" | "message";

export type SlackGuestPrepState = {
  threadTs: string;
  step: "person" | "location" | "outcome" | "concern" | "complete";
  person?: string;
  location?: "written" | "call" | "in_person";
  outcome?: string;
  concern?: string;
};

export type SlackGuestPracticeState = {
  threadTs: string;
  prepThreadTs: string;
  person: string;
  location: "written" | "call" | "in_person";
  outcome: string;
  concern: string;
};

export type SlackGuestSelectedMessageState = {
  threadTs: string;
  intent: "decode" | "respond";
  author: string;
  message: string;
  sourceChannelId?: string;
  sourceChannelName?: string;
  sourceMessageTs?: string;
  sourceThreadTs?: string;
  context?: string;
};

export const SLACK_GUEST_PREP_PRACTICE_ACTION_ID = "beckett_guest_prep_practice";

export function rehydrateSlackGuestPrepState(
  threadTs: string,
  turns: SlackThreadTurn[],
  currentStep: SlackGuestPrepState["step"] = "person"
): SlackGuestPrepState {
  return rehydrateSlackGuestPrepFromTurns(threadTs, turns, currentStep);
}

export async function loadSlackGuestPrepState({
  teamId,
  slackUserId,
  threadTs,
  channelId,
  accessToken,
  latestUserText,
}: {
  teamId: string;
  slackUserId: string;
  threadTs: string;
  channelId?: string | null;
  accessToken?: string | null;
  latestUserText?: string | null;
}) {
  const zeroCopy = await findSlackZeroCopyFlowSessionByThreadReference({ teamId, slackUserId, threadTs });
  if (zeroCopy?.flow_type === "prep") {
    if (accessToken && (channelId || zeroCopy.slack_channel_id)) {
      const snapshot = await fetchSlackThreadSnapshot({
        accessToken,
        channelId: channelId || zeroCopy.slack_channel_id,
        threadTs,
        currentSlackUserId: slackUserId,
      });
      if (snapshot.status === "available") {
        return rehydrateSlackGuestPrepState(
          threadTs,
          withoutLatestSlackUserTurn(snapshot.turns, latestUserText),
          (zeroCopy.current_step || "person") as SlackGuestPrepState["step"]
        );
      }
    }
    return { threadTs, step: (zeroCopy.current_step || "person") as SlackGuestPrepState["step"] };
  }
  return null;
}

export async function saveSlackGuestPrepState({
  teamId,
  slackUserId,
  state,
}: {
  teamId: string;
  slackUserId: string;
  state: SlackGuestPrepState;
}) {
  await upsertSlackZeroCopyFlowSession({
    slackTeamId: teamId,
    slackUserId,
    slackThreadTs: state.threadTs,
    flowType: "prep",
    currentStep: state.step,
    status: "active",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}

export async function loadSlackGuestPracticeState({
  teamId,
  slackUserId,
  threadTs,
  accessToken,
}: {
  teamId: string;
  slackUserId: string;
  threadTs: string;
  accessToken?: string | null;
}) {
  const zeroCopy = await findSlackZeroCopyFlowSessionByThreadReference({ teamId, slackUserId, threadTs });
  if (zeroCopy?.flow_type === "practice") {
    const prep = zeroCopy.slack_source_thread_ts && accessToken
      ? await loadSlackGuestPrepState({
          teamId,
          slackUserId,
          threadTs: zeroCopy.slack_source_thread_ts,
          accessToken,
        })
      : null;
    if (prep?.person && prep.location && prep.outcome && prep.concern) {
      return {
        threadTs,
        prepThreadTs: zeroCopy.slack_source_thread_ts || "",
        person: prep.person,
        location: prep.location,
        outcome: prep.outcome,
        concern: prep.concern,
      } satisfies SlackGuestPracticeState;
    }
    return null;
  }
  return null;
}

export async function saveSlackGuestPracticeState({
  teamId,
  slackUserId,
  state,
}: {
  teamId: string;
  slackUserId: string;
  state: SlackGuestPracticeState;
}) {
  await upsertSlackZeroCopyFlowSession({
    slackTeamId: teamId,
    slackUserId,
    slackThreadTs: state.threadTs,
    slackSourceThreadTs: state.prepThreadTs,
    flowType: "practice",
    currentStep: "active",
    status: "active",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}

export async function loadSlackGuestSelectedMessageState({
  teamId,
  slackUserId,
  threadTs,
  accessToken,
}: {
  teamId: string;
  slackUserId: string;
  threadTs: string;
  accessToken?: string | null;
}): Promise<SlackGuestSelectedMessageState | null> {
  const zeroCopy = await findSlackZeroCopyFlowSessionByThreadReference({ teamId, slackUserId, threadTs });
  if (zeroCopy && (zeroCopy.flow_type === "decode" || zeroCopy.flow_type === "respond")) {
    if (!accessToken || !zeroCopy.slack_source_channel_id) return null;
    const context = await fetchSlackConversationContext({
      accessToken,
      channelId: zeroCopy.slack_source_channel_id,
      messageTs: zeroCopy.slack_source_message_ts,
      threadTs: zeroCopy.slack_source_thread_ts,
    });
    if (context.status !== "available" || !context.text) return null;
    return {
      threadTs,
      intent: zeroCopy.flow_type,
      author: "the selected-message author",
      message: context.text,
      sourceChannelId: zeroCopy.slack_source_channel_id,
      sourceMessageTs: zeroCopy.slack_source_message_ts || undefined,
      sourceThreadTs: zeroCopy.slack_source_thread_ts || undefined,
    } satisfies SlackGuestSelectedMessageState;
  }
  return null;
}

export async function saveSlackGuestSelectedMessageState({
  teamId,
  slackUserId,
  state,
}: {
  teamId: string;
  slackUserId: string;
  state: SlackGuestSelectedMessageState;
}) {
  await upsertSlackZeroCopyFlowSession({
    slackTeamId: teamId,
    slackUserId,
    slackThreadTs: state.threadTs,
    slackSourceChannelId: state.sourceChannelId || null,
    slackSourceThreadTs: state.sourceThreadTs || null,
    slackSourceMessageTs: state.sourceMessageTs || null,
    flowType: state.intent,
    currentStep: "selected_message",
    status: "active",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}

export type SlackCoachingThread = {
  id: string;
  user_id: string;
  slack_team_id: string;
  slack_user_id: string;
  slack_channel_id: string | null;
  thread_ts: string | null;
  source_channel_id: string | null;
  source_channel_name: string | null;
  flow_type: SlackHistoryFlowType;
  title: string;
  summary: string | null;
  prompt_snippet: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type SlackCoachingMessage = {
  id: string;
  coaching_thread_id: string;
  user_id: string;
  slack_team_id: string;
  slack_user_id: string;
  role: "user" | "beckett";
  content: string;
  created_at: string;
};

// Legacy content shape retained only for a separately approved migration/purge operation.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type SlackCoachingBotMessage = {
  id: string;
  coaching_thread_id: string;
  user_id: string;
  slack_channel_id: string;
  slack_message_ts: string;
  kind: string | null;
  created_at?: string | null;
  deleted_at: string | null;
};

type UpsertThreadInput = {
  user: SlackConnectedUser;
  teamId: string;
  slackUserId: string;
  flowType: SlackHistoryFlowType;
  title: string;
  promptSnippet?: string | null;
  summary?: string | null;
  slackChannelId?: string | null;
  threadTs?: string | null;
  sourceChannelId?: string | null;
  sourceChannelName?: string | null;
  status?: "active" | "completed";
};

function truncate(value: string | null | undefined, length: number) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length - 3).trim()}...`;
}

function flowLabel(flowType: SlackHistoryFlowType) {
  switch (flowType) {
    case "respond":
      return "Respond";
    case "rewrite":
      return "Rewrite";
    case "decode":
      return "Decode";
    case "relationship":
      return "Relationship read";
    case "prep":
      return "Prep";
    case "practice":
      return "Practice";
    case "message":
      return "Message coaching";
  }
}

function zeroCopyFlowToHistoryType(flowType: SlackZeroCopyFlowSession["flow_type"]): SlackHistoryFlowType {
  return flowType === "general" ? "message" : flowType;
}

function zeroCopyFlowToCoachingThread(flow: SlackZeroCopyFlowSession): SlackCoachingThread {
  const flowType = zeroCopyFlowToHistoryType(flow.flow_type);
  return {
    id: flow.id,
    user_id: flow.beckett_user_id || "",
    slack_team_id: flow.slack_team_id,
    slack_user_id: flow.slack_user_id,
    slack_channel_id: flow.slack_channel_id,
    thread_ts: flow.slack_thread_ts,
    source_channel_id: flow.slack_source_channel_id,
    source_channel_name: null,
    flow_type: flowType,
    title: flowLabel(flowType),
    summary: null,
    prompt_snippet: null,
    status: flow.status,
    created_at: flow.created_at,
    updated_at: flow.updated_at,
    archived_at: flow.archived_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sanitizeLegacyCoachingThread(thread: SlackCoachingThread): SlackCoachingThread {
  return {
    ...thread,
    source_channel_name: null,
    title: flowLabel(thread.flow_type),
    summary: null,
    prompt_snippet: null,
  };
}

export function slackHistoryTitle(flowType: SlackHistoryFlowType, sourceLabel?: string | null) {
  return truncate(`${flowLabel(flowType)}: ${sourceLabel || "this Slack conversation"}`, 120);
}

function oneSentenceSummary(value: string | null | undefined, fallback: string) {
  const cleaned = (value || fallback || "")
    .replace(/\bReply in this Beckett thread to keep this saved as one conversation\..*$/i, "")
    .replace(/\bStart a new Beckett message to begin a separate case\./i, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const firstSentence = cleaned.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || cleaned;
  return truncate(firstSentence, 140) || "Open this coaching thread to keep working with Beckett.";
}

export function summarizeSlackCoachingResponse(response: string, fallback: string) {
  const cleaned = response
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean)
    .filter((line) => !/^(Possible read|Next move|Draft options|What is visible|What not to over-read|Rewritten message|Why this works)$/i.test(line))
    .filter((line) => !/^Reply in this Beckett thread to keep this saved as one conversation/i.test(line))
    .filter((line) => !/^Start a new Beckett message to begin a separate case/i.test(line));

  return oneSentenceSummary(cleaned.join(" "), fallback);
}

export async function createSlackCoachingThread(input: UpsertThreadInput) {
  const flowType = normalizeSlackZeroCopyFlowType(input.flowType);
  const data = await upsertSlackZeroCopyFlowSession({
    slackTeamId: input.teamId,
    slackUserId: input.slackUserId,
    beckettUserId: input.user.id,
    slackChannelId: input.slackChannelId || null,
    slackThreadTs: input.threadTs || null,
    slackSourceChannelId: input.sourceChannelId || null,
    flowType,
    status: input.status || "active",
  });
  return zeroCopyFlowToCoachingThread(data);
}

export async function updateSlackCoachingThread(
  threadId: string | null | undefined,
  patch: Partial<Pick<SlackCoachingThread, "slack_channel_id" | "thread_ts" | "summary" | "status" | "title">>
) {
  if (!threadId) return null;
  const zeroCopy = await loadSlackZeroCopyFlowSession(threadId);
  if (zeroCopy) {
    const updated = await updateSlackZeroCopyFlowSession(threadId, {
      ...(patch.slack_channel_id !== undefined ? { slackChannelId: patch.slack_channel_id } : {}),
      ...(patch.thread_ts !== undefined ? { slackThreadTs: patch.thread_ts } : {}),
      ...(patch.status !== undefined
        ? { status: patch.status === "archived" ? "archived" : patch.status === "completed" ? "completed" : "active" }
        : {}),
    });
    return updated ? zeroCopyFlowToCoachingThread(updated) : null;
  }
  return null;
}

export async function appendSlackCoachingMessage({
  threadId,
  user,
  teamId,
  slackUserId,
  role,
  content,
}: {
  threadId?: string | null;
  user: SlackConnectedUser;
  teamId: string;
  slackUserId: string;
  role: SlackCoachingMessage["role"];
  content?: string | null;
}) {
  void threadId;
  void user;
  void teamId;
  void slackUserId;
  void role;
  void content;
  return null;
}

export async function recordSlackCoachingBotMessage({
  threadId,
  userId,
  channelId,
  messageTs,
  kind,
}: {
  threadId?: string | null;
  userId?: string | null;
  channelId?: string | null;
  messageTs?: string | null;
  kind?: string | null;
}) {
  if (!threadId || !userId || !channelId || !messageTs) return null;
  const zeroCopy = await loadSlackZeroCopyFlowSession(threadId, userId);
  if (zeroCopy) {
    return recordSlackZeroCopyBotMessage({
      flowSessionId: threadId,
      beckettUserId: userId,
      channelId,
      messageTs,
      kind,
    });
  }
  return null;
}

export async function cleanupSlackCoachingBotMessages({
  botAccessToken,
  threadId,
  userId,
}: {
  botAccessToken?: string | null;
  threadId: string;
  userId: string;
}) {
  if (!botAccessToken) return;
  const zeroCopy = await loadSlackZeroCopyFlowSession(threadId, userId);
  if (zeroCopy) {
    const messages = await listSlackZeroCopyBotMessages(threadId, userId);
    for (const message of messages) {
      const result = await slackApiPost(botAccessToken, "chat.delete", {
        channel: message.slack_channel_id,
        ts: message.slack_message_ts,
      }).catch(() => null);
      if (result?.ok) {
        await markSlackZeroCopyBotMessageDeleted(message.id);
      } else if (result && !result.ok) {
        console.info("Slack bot message cleanup skipped", {
          threadId,
          channelId: message.slack_channel_id,
          messageTs: message.slack_message_ts,
          error: result.error || "unknown_error",
        });
      }
    }
    return;
  }
  return;
}

export async function loadSlackCoachingMessages({
  threadId,
  userId,
  limit = 12,
}: {
  threadId: string;
  userId: string;
  limit?: number;
}): Promise<SlackCoachingMessage[]> {
  void threadId;
  void userId;
  void limit;
  return [];
}

export function formatSlackCoachingMessages(messages: SlackCoachingMessage[], maxLength = 1800) {
  const transcript = messages
    .map((message) => `${message.role === "user" ? "User" : "Beckett"}: ${message.content}`)
    .join("\n\n");
  const cleaned = transcript.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3).trim()}...`;
}

export async function findSlackCoachingThreadBySlackThread({
  userId,
  teamId,
  slackUserId,
  channelId,
  threadTs,
}: {
  userId: string;
  teamId: string;
  slackUserId: string;
  channelId: string;
  threadTs: string;
}) {
  if (!threadTs) return null;
  const zeroCopy = await findSlackZeroCopyFlowSession({ teamId, slackUserId, channelId, threadTs });
  if (zeroCopy && (!zeroCopy.beckett_user_id || zeroCopy.beckett_user_id === userId)) {
    return zeroCopyFlowToCoachingThread(zeroCopy);
  }
  return null;
}

export async function completeActiveSlackSessionsForThread({
  threadId,
  userId,
}: {
  threadId: string;
  userId: string;
}) {
  const zeroCopyResult = await slackRepository
    .from("slack_agent_sessions")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("zero_copy_flow_session_id", threadId)
    .eq("user_id", userId)
    .eq("status", "active");
  if (zeroCopyResult.error) throw zeroCopyResult.error;
}

export async function listRecentSlackCoachingThreads(userId: string, limit = 8) {
  const zeroCopy = await listSlackZeroCopyFlowSessions(userId, limit);
  return zeroCopy.map(zeroCopyFlowToCoachingThread);
}

export async function archiveSlackCoachingThread({
  threadId,
  userId,
}: {
  threadId: string;
  userId: string;
}) {
  const zeroCopy = await loadSlackZeroCopyFlowSession(threadId, userId);
  if (zeroCopy) {
    const now = new Date().toISOString();
    await updateSlackZeroCopyFlowSession(threadId, { status: "archived", archivedAt: now });
    await completeActiveSlackSessionsForThread({ threadId, userId });
    return;
  }
  return;
}

export async function loadSlackCoachingThread({
  threadId,
  userId,
}: {
  threadId: string;
  userId: string;
}) {
  const zeroCopy = await loadSlackZeroCopyFlowSession(threadId, userId);
  if (zeroCopy) return zeroCopyFlowToCoachingThread(zeroCopy);
  return null;
}

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(elapsed / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function historyCard(thread: SlackCoachingThread): SlackBlock[] {
  const status = thread.archived_at ? "archived" : thread.status;
  const elements: Record<string, unknown>[] = [
    {
      type: "button",
      text: { type: "plain_text", text: "Continue" },
      style: "primary",
      action_id: SLACK_HISTORY_CONTINUE_ACTION_ID,
      value: JSON.stringify({ threadId: thread.id }),
    },
  ];

  if (!thread.archived_at) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "Archive" },
      action_id: SLACK_HISTORY_ARCHIVE_ACTION_ID,
      value: JSON.stringify({ threadId: thread.id }),
    });
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${flowLabel(thread.flow_type)} · ${relativeTime(thread.updated_at)}*\n_${status}_`,
      },
    },
    {
      type: "actions",
      elements,
    },
    { type: "divider" },
  ];
}

export function buildSlackHomeBlocks(threads: SlackCoachingThread[], notice?: string | null, creditLine?: string | null): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Beckett History" },
    },
    ...(creditLine ? [{ type: "section", text: { type: "mrkdwn", text: creditLine } }] : []),
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Recent Beckett coaching conversations. Continue anything you want to revisit, or archive active threads when you are done.",
      },
    },
    ...(notice
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: notice,
            },
          },
        ]
      : []),
    { type: "divider" },
  ];

  if (!threads.length) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "No conversations yet. Open Messages to start with Decode, Respond, Rewrite, or Prep.",
      },
    });
    return blocks;
  }

  for (const thread of threads) blocks.push(...historyCard(thread));
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: "<https://www.meetbeckett.co/dashboard/settings|Manage plan> · <https://www.meetbeckett.co/pricing|Upgrade> · <https://www.meetbeckett.co/privacy|Privacy> · <https://www.meetbeckett.co/support|Support>" }] });
  return blocks.slice(0, 90);
}

export function buildSlackConnectHomeBlocks(linkUrl: string, creditLine = "5 free coaching credits per day") : SlackBlock[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Beckett History" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${creditLine}*\nUse Beckett immediately. Link an account only if you want to share your Beckett subscription and daily allowance.`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Messages is where you work with Beckett. Home keeps only generic flow references; Slack remains the transcript system of record.",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Link Beckett account" },
          action_id: SLACK_HISTORY_SETTINGS_ACTION_ID,
          url: linkUrl,
        },
      ],
    },
    { type: "context", elements: [{ type: "mrkdwn", text: "<https://www.meetbeckett.co/pricing|Plans> · <https://www.meetbeckett.co/privacy|Privacy> · <https://www.meetbeckett.co/support|Support>" }] },
  ];
}

export async function publishSlackHome({
  botAccessToken,
  slackUserId,
  userId,
  notice,
}: {
  botAccessToken: string | null;
  slackUserId: string;
  userId: string;
  notice?: string | null;
}) {
  if (!botAccessToken) return { ok: false, error: "missing_bot_token" };
  let threads: SlackCoachingThread[] = [];
  try {
    threads = await listRecentSlackCoachingThreads(userId);
  } catch (error) {
    console.error("Slack Home history lookup failed", {
      userPresent: Boolean(userId),
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const credits = await metering.web.report(userId).catch(() => null);
  const creditLine = credits?.enabled
    ? `*${credits.daily.remaining} coaching credits remaining today* · ${credits.plan} plan · resets daily at 00:00 UTC`
    : null;

  return slackApiPost(botAccessToken, "views.publish", {
    user_id: slackUserId,
    view: {
      type: "home",
      blocks: buildSlackHomeBlocks(threads, notice, creditLine),
    },
  });
}

export function buildSlackThreadArchiveAction(threadId: string | null | undefined) {
  if (!threadId) return [];
  return [
    {
      type: "button",
      text: { type: "plain_text", text: "Archive conversation" },
      action_id: SLACK_HISTORY_ARCHIVE_ACTION_ID,
      value: JSON.stringify({ threadId }),
    },
  ];
}

export function buildSlackExplainMoreAction(threadId: string | null | undefined) {
  if (!threadId) return [];
  return [
    {
      type: "button",
      text: { type: "plain_text", text: "Explain more" },
      action_id: SLACK_HISTORY_EXPLAIN_MORE_ACTION_ID,
      value: JSON.stringify({ threadId }),
    },
  ];
}

export function buildSlackStartCardPayload(variant: "archived" | "inactivity" = "archived") {
  const body = variant === "inactivity"
    ? [
        "Want to start something new? All conversations are saved on the Home tab.",
        "",
        "What can I help with next?",
      ].join("\n")
    : [
        "The last conversation was archived. If you’d like to revisit that conversation, you can find it under the Home tab.",
        "",
        "What can I help with next?",
      ].join("\n");

  const descriptions = [
    "Decode a Selected Message — understand tone and possible subtext.",
    "Respond to a Selected Message — get short reply options.",
    "Edit a Draft — rewrite while preserving your meaning.",
    "Prep — prepare for a conversation, then optionally practice it.",
  ].join("\n");

  return buildBeckettPayload({
    title: "Beckett",
    subtitle: "",
    body: `${body}\n\n${descriptions}`,
    hideTitle: true,
    actions: [
      {
        type: "button",
        text: { type: "plain_text", text: "Decode a Selected Message" },
        action_id: `${SLACK_HISTORY_QUICK_ACTION_ID}_decode`,
        value: JSON.stringify({ flowType: "decode" }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Respond to a Selected Message" },
        action_id: `${SLACK_HISTORY_QUICK_ACTION_ID}_respond`,
        value: JSON.stringify({ flowType: "respond" }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Edit a Draft" },
        action_id: `${SLACK_HISTORY_QUICK_ACTION_ID}_rewrite`,
        value: JSON.stringify({ flowType: "rewrite" }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Prep" },
        action_id: `${SLACK_HISTORY_QUICK_ACTION_ID}_prep`,
        value: JSON.stringify({ flowType: "prep" }),
      },
    ],
  });
}

export async function cancelSlackInactivityStartCard({
  botAccessToken,
  channelId,
}: {
  botAccessToken?: string | null;
  channelId?: string | null;
}) {
  if (!botAccessToken || !channelId) return;

  const { data: reservation } = await slackRepository
    .from("slack_inactivity_schedules")
    .select("scheduled_message_id")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (reservation?.scheduled_message_id) {
    await slackApiPost(botAccessToken, "chat.deleteScheduledMessage", {
      channel: channelId,
      scheduled_message_id: reservation.scheduled_message_id,
    }).catch(() => null);
  }

  const pending = await slackApiPost<{
    scheduled_messages?: Array<{ id?: string }>;
  }>(botAccessToken, "chat.scheduledMessages.list", {
    channel: channelId,
    limit: 100,
  }).catch(() => null);
  for (const scheduled of pending?.scheduled_messages || []) {
    if (!scheduled.id || scheduled.id === reservation?.scheduled_message_id) continue;
    await slackApiPost(botAccessToken, "chat.deleteScheduledMessage", {
      channel: channelId,
      scheduled_message_id: scheduled.id,
    }).catch(() => null);
  }

  await slackRepository
    .from("slack_inactivity_schedules")
    .delete()
    .eq("channel_id", channelId);
  beckettSlackScheduledMessages.delete(channelId);
}

export async function scheduleSlackInactivityStartCard({
  botAccessToken,
  channelId,
}: {
  botAccessToken?: string | null;
  threadId?: string | null;
  userId?: string | null;
  channelId?: string | null;
}) {
  if (!botAccessToken || !channelId) return;

  // Older routes still call this helper after a response. Apply the current
  // policy here so every Guest and connected-user path also clears old timers.
  if (!shouldScheduleSlackInactivityStartCard()) {
    await cancelSlackInactivityStartCard({ botAccessToken, channelId });
    return;
  }

  const payload = buildSlackStartCardPayload("inactivity");
  const generation = crypto.randomUUID();
  const { data: previousSchedule, error: previousScheduleError } = await slackRepository
    .from("slack_inactivity_schedules")
    .select("scheduled_message_id")
    .eq("channel_id", channelId)
    .maybeSingle();
  const { error: reservationError } = await slackRepository
    .from("slack_inactivity_schedules")
    .upsert({
      channel_id: channelId,
      generation,
      scheduled_message_id: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "channel_id" });
  const durableReservation = !previousScheduleError && !reservationError;
  const knownScheduledId = durableReservation
    ? previousSchedule?.scheduled_message_id
    : beckettSlackScheduledMessages.get(channelId);
  if (knownScheduledId) {
    const removedKnown = await slackApiPost(botAccessToken, "chat.deleteScheduledMessage", {
      channel: channelId,
      scheduled_message_id: knownScheduledId,
    }).catch(() => null);
    if (removedKnown?.ok) beckettSlackScheduledMessages.delete(channelId);
    else {
      console.warn("Slack known inactivity timer deletion failed", {
        channelPresent: true,
        error: removedKnown?.error || "slack_api_error",
      });
    }
  }
  const pending = await slackApiPost<{
    scheduled_messages?: Array<{ id?: string; text?: string }>;
  }>(botAccessToken, "chat.scheduledMessages.list", {
    channel: channelId,
    limit: 100,
  }).catch(() => null);

  for (const scheduled of durableReservation ? [] : pending?.scheduled_messages || []) {
    // This bot only schedules inactivity cards. Slack does not reliably return
    // block-kit fallback text from scheduledMessages.list, so filtering on the
    // visible marker left older timers alive and caused duplicate menus.
    if (!scheduled.id) continue;
    const removed = await slackApiPost(botAccessToken, "chat.deleteScheduledMessage", {
      channel: channelId,
      scheduled_message_id: scheduled.id,
    }).catch(() => null);
    if (!removed?.ok) {
      console.warn("Slack listed inactivity timer deletion failed", {
        channelPresent: true,
        error: removed?.error || "slack_api_error",
      });
    }
  }

  const postAt = Math.ceil((Date.now() + SLACK_INACTIVITY_START_CARD_DELAY_MS) / 1000);
  console.info("Slack inactivity card scheduling", {
    channelPresent: Boolean(channelId),
    delayMs: SLACK_INACTIVITY_START_CARD_DELAY_MS,
    postAt,
  });
  const scheduled = await slackApiPost<{ scheduled_message_id?: string }>(botAccessToken, "chat.scheduleMessage", {
    channel: channelId,
    post_at: postAt,
    ...payload,
  });
  if (!scheduled.ok) throw new Error(scheduled.error || "slack_schedule_message_failed");
  if (scheduled.scheduled_message_id) {
    if (durableReservation) {
      await slackRepository
        .from("slack_inactivity_schedules")
        .update({
          scheduled_message_id: scheduled.scheduled_message_id,
          updated_at: new Date().toISOString(),
        })
        .eq("channel_id", channelId)
        .eq("generation", generation);
      const { data: currentReservation } = await slackRepository
        .from("slack_inactivity_schedules")
        .select("generation")
        .eq("channel_id", channelId)
        .maybeSingle();
      if (currentReservation?.generation !== generation) {
        await slackApiPost(botAccessToken, "chat.deleteScheduledMessage", {
          channel: channelId,
          scheduled_message_id: scheduled.scheduled_message_id,
        }).catch(() => null);
        return;
      }
    } else {
      beckettSlackScheduledMessages.set(channelId, scheduled.scheduled_message_id);
    }
  }

  // Several Slack event paths can finish at nearly the same time. Re-list after
  // scheduling and deterministically keep only the newest start-card timer.
  const after = await slackApiPost<{
    scheduled_messages?: Array<{ id?: string; text?: string; post_at?: number | string }>;
  }>(botAccessToken, "chat.scheduledMessages.list", {
    channel: channelId,
    limit: 100,
  }).catch(() => null);
  const markerSchedules = (durableReservation ? [] : after?.scheduled_messages || [])
    .filter((item) => item.id)
    .sort((a, b) => {
      const timeDifference = Number(b.post_at || 0) - Number(a.post_at || 0);
      return timeDifference || String(b.id).localeCompare(String(a.id));
    });
  for (const duplicate of markerSchedules.slice(1)) {
    const removed = await slackApiPost(botAccessToken, "chat.deleteScheduledMessage", {
      channel: channelId,
      scheduled_message_id: duplicate.id,
    }).catch(() => null);
    if (!removed?.ok) {
      console.warn("Slack duplicate inactivity timer deletion failed", {
        channelPresent: true,
        error: removed?.error || "slack_api_error",
      });
    }
  }
}

export async function publishSlackConnectHome({
  botAccessToken,
  slackUserId,
  settingsUrl,
  creditLine,
}: {
  botAccessToken: string | null;
  slackUserId: string;
  settingsUrl: string;
  creditLine?: string;
}) {
  if (!botAccessToken) return { ok: false, error: "missing_bot_token" };
  return slackApiPost(botAccessToken, "views.publish", {
    user_id: slackUserId,
    view: {
      type: "home",
      blocks: buildSlackConnectHomeBlocks(settingsUrl, creditLine),
    },
  });
}

export async function publishSlackHomeResult(input: {
  botAccessToken: string | null;
  slackUserId: string;
  userId: string;
}) {
  const result = await publishSlackHome(input);
  if (!result.ok) {
    console.error("Slack views.publish failed", {
      slackUserPresent: Boolean(input.slackUserId),
      error: result.error || "unknown_error",
      response: result,
    });
  }
  return result;
}

export function buildSlackHistoryContinuePayload(
  thread: SlackCoachingThread,
  messages: SlackCoachingMessage[] = [],
  liveTranscript?: string | null
) {
  const transcript = liveTranscript || formatSlackCoachingMessages(messages, 1800);
  const payload = buildBeckettPayload({
    title: "Beckett",
    subtitle: "",
    body: [
      `Picking this back up: ${thread.title}`,
      "",
      thread.summary || thread.prompt_snippet || "We were working through this conversation together.",
      transcript ? `\nRecent conversation:\n${transcript}` : "",
      "",
      "What do you want to do next?",
    ].join("\n"),
    hideTitle: true,
    actions: [
      {
        type: "button",
        text: { type: "plain_text", text: "Practice" },
        action_id: `${SLACK_HISTORY_QUICK_ACTION_ID}_practice`,
        value: JSON.stringify({ flowType: "practice", threadId: thread.id }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Rewrite" },
        action_id: `${SLACK_HISTORY_QUICK_ACTION_ID}_rewrite`,
        value: JSON.stringify({ flowType: "rewrite", threadId: thread.id }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Draft follow-up" },
        action_id: `${SLACK_HISTORY_QUICK_ACTION_ID}_respond`,
        value: JSON.stringify({ flowType: "respond", threadId: thread.id }),
      },
    ],
  });
  return payload;
}

export function parseSlackHistoryAction(value: string | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as { threadId?: string; flowType?: SlackHistoryFlowType };
  } catch {
    return null;
  }
}
