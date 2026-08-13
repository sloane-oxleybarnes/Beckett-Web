import { slackRepository } from "@/lib/repositories/slack-repository"
import { slackUserIdentifier } from '@/lib/contact-identifiers'
import { lookupRelationshipContextByIdentifier } from '@/lib/contact-relationship-context'
import { getSlackInstallationToken } from '@/lib/slack-installation'
import { slackApiRetryDelayMs } from '@/lib/slack-api-retry'
import { shouldLoadGuestConversationContext } from '@/lib/slack-guest-routing'
import { settleSlackCreditForPayload } from '@/lib/slack-credits'
import type { SlackThreadTurn } from '@/lib/slack-thread-rehydration'
import {
  MAX_SLACK_BROAD_CONTEXT_LENGTH, MAX_SLACK_BROAD_CONTEXT_RESULTS, MAX_SLACK_CONTEXT_LENGTH, MAX_SLACK_CONTEXT_MESSAGES, REQUIRED_SLACK_USER_SCOPES,
  buildBeckettPayload, isCompactSlackIntent,
  metadataRecord, normalizeSlackUserId, slackContextFailureReasonForError, slackUnavailable,
  slackUserIdsFromMessages, splitSlackScopes, uniqueSlackUserIds,
  slackUserNameCache, type SlackCoachingIntent, type SlackConnectedUser, type SlackContextFailureReason, type SlackContextStatus, type SlackConversationContext, type SlackHistoryMessage,
  type SlackLatestMessageContext, type SlackLegacySearchResponse, type SlackSearchContextResponse, type SlackSearchInfoResponse,
  type SlackThreadSnapshot, type SlackUserInfo,
} from './message'

export async function lookupSlackConnectedUser(teamId: string, slackUserId: string) {
  const { data: link, error: linkError } = await slackRepository
    .from("slack_user_links")
    .select("beckett_user_id")
    .eq("slack_team_id", teamId)
    .eq("slack_user_id", slackUserId)
    .is("disconnected_at", null)
    .maybeSingle();
  if (linkError) throw linkError;

  let integration: { user_id: string; access_token: string | null; external_team_name: string | null; metadata: Record<string, unknown> } | null = null;
  if (link?.beckett_user_id) {
    integration = {
      user_id: link.beckett_user_id,
      access_token: null,
      external_team_name: null,
      metadata: { access_token: await getSlackInstallationToken(teamId), granted_user_scopes: [] },
    };
  } else {
    const legacy = await slackRepository
      .from("user_integrations")
      .select("user_id, access_token, external_team_name, metadata")
      .eq("provider", "slack")
      .eq("external_team_id", teamId)
      .eq("external_user_id", slackUserId)
      .maybeSingle();
    if (legacy.error) throw legacy.error;
    integration = legacy.data as typeof integration;
  }

  if (!integration?.user_id) return null;

  const { data: profile, error: profileError } = await slackRepository
    .from("profiles")
    .select(
      "id, email, display_name, first_name, full_name, plan, communication_preferences, coaching_tone, strengths, workplace_triggers, neurodivergent_context, neurodivergent_context_other"
    )
    .eq("id", integration.user_id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return null;

  const metadata = metadataRecord(integration.metadata);
  const authedUser = metadataRecord(metadata.authed_user);
  const grantedUserScopes = splitSlackScopes(metadata.granted_user_scopes || authedUser.scope || metadata.user_scope);
  const missingUserScopes = REQUIRED_SLACK_USER_SCOPES.filter((scope) => !grantedUserScopes.includes(scope));
  const { data: toolkitItems } = await slackRepository
    .from("course_toolkit_items")
    .select("course_id, category, label, content, updated_at")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(6);

  return {
    id: profile.id,
    email: profile.email || null,
    name: profile.display_name || profile.first_name || profile.full_name || null,
    plan: profile.plan || "free",
    accessToken: integration.access_token || null,
    botAccessToken: typeof metadata.access_token === "string" ? metadata.access_token : null,
    teamName: integration.external_team_name || null,
    grantedUserScopes,
    missingUserScopes,
    communicationPreferences: Array.isArray(profile.communication_preferences)
      ? profile.communication_preferences
      : [],
    coachingTone: profile.coaching_tone || null,
    strengths: Array.isArray(profile.strengths) ? profile.strengths : [],
    workplaceTriggers: Array.isArray(profile.workplace_triggers) ? profile.workplace_triggers : [],
    neurodivergentContext: Array.isArray(profile.neurodivergent_context)
      ? profile.neurodivergent_context
      : [],
    neurodivergentContextOther: profile.neurodivergent_context_other || null,
    toolkitItems: toolkitItems || [],
    slackTeamId: teamId,
    slackUserId,
  } satisfies SlackConnectedUser;
}

export async function lookupSlackWorkspaceBotToken(teamId: string) {
  const envBotToken =
    process.env.SLACK_BOT_TOKEN?.trim() ||
    process.env.SLACK_WORKSPACE_BOT_TOKEN?.trim() ||
    process.env.SLACK_APP_BOT_TOKEN?.trim() ||
    null;

  if (!teamId) return null;

  const installationToken = await getSlackInstallationToken(teamId).catch(() => null);
  if (installationToken) return installationToken;

  const { data, error } = await slackRepository
    .from("user_integrations")
    .select("metadata")
    .eq("provider", "slack")
    .eq("external_team_id", teamId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const metadata = metadataRecord(data?.metadata);
  return typeof metadata.access_token === "string" ? metadata.access_token : envBotToken;
}

export async function slackApiPost<T>(accessToken: string, method: string, body: Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({})) as T & { ok?: boolean; error?: string };
    const retryDelay = slackApiRetryDelayMs({
      attempt,
      status: res.status,
      retryAfter: res.headers.get("retry-after"),
      error: result.error,
    });
    if (retryDelay === null || attempt === 3) {
      await settleSlackCreditForPayload(body, Boolean(result.ok)).catch((error) => console.error("Slack credit settlement failed", { method, message: error instanceof Error ? error.message : String(error) }));
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }

  return {} as T & { ok?: boolean; error?: string };
}

async function openSlackAgentChannel(botAccessToken: string, slackUserId: string) {
  const opened = await slackApiPost<{ channel?: { id?: string } }>(botAccessToken, "conversations.open", {
    users: slackUserId,
  });
  const channelId = opened.channel?.id;
  if (!opened.ok || !channelId) return { ok: false, error: opened.error || "dm_open_failed" };
  return { ok: true, channelId };
}

export async function setSlackAgentSuggestedPrompts({
  botAccessToken,
  channelId,
  title = "What can I help with today?",
}: {
  botAccessToken: string | null;
  channelId: string;
  title?: string;
}) {
  if (!botAccessToken || !channelId) return { ok: false, error: "missing_agent_context" };

  return slackApiPost(botAccessToken, "assistant.threads.setSuggestedPrompts", {
    channel_id: channelId,
    title,
    prompts: [
      {
        title: "Decode a Selected Message",
        message: "Help me decode a Slack message.",
      },
      {
        title: "Respond to a Selected Message",
        message: "Help me draft a response to a Slack message.",
      },
      {
        title: "Edit a Draft",
        message: "Help me rewrite a draft.",
      },
      {
        title: "Prep",
        message: "Help me prepare for a difficult conversation.",
      },
    ],
  });
}

export async function configureSlackAgentSurface({
  botAccessToken,
  slackUserId,
  channelId,
}: {
  botAccessToken: string | null;
  slackUserId: string;
  channelId?: string | null;
}) {
  if (!botAccessToken) return { ok: false, error: "missing_bot_token" };
  const targetChannelId = channelId || (await openSlackAgentChannel(botAccessToken, slackUserId)).channelId;
  if (!targetChannelId) return { ok: false, error: "agent_channel_unavailable" };

  await setSlackAgentSuggestedPrompts({
    botAccessToken,
    channelId: targetChannelId,
  });

  return { ok: true, channelId: targetChannelId };
}

export async function postSlackAgentMessage({
  botAccessToken,
  slackUserId,
  text,
  title,
  subtitle = "",
}: {
  botAccessToken: string | null;
  slackUserId: string;
  text: string;
  title: string;
  subtitle?: string;
}) {
  if (!botAccessToken) return { ok: false, error: "missing_bot_token" };

  const opened = await openSlackAgentChannel(botAccessToken, slackUserId);
  if (!opened.ok || !opened.channelId) return opened;
  const channelId = opened.channelId;

  const payload = buildBeckettPayload({
    title: "Beckett",
    subtitle,
    body: text,
    hideTitle: true,
  });

  const posted = await slackApiPost<{ ts?: string }>(botAccessToken, "chat.postMessage", {
    channel: channelId,
    ...payload,
  });
  if (!posted.ok || !posted.ts) return { ok: false, error: posted.error || "agent_post_failed" };

  await slackApiPost(botAccessToken, "assistant.threads.setTitle", {
    channel_id: channelId,
    thread_ts: posted.ts,
    title: title.slice(0, 80),
  }).catch(() => null);

  await setSlackAgentSuggestedPrompts({
    botAccessToken,
    channelId,
  }).catch(() => null);

  return { ok: true, channelId, ts: posted.ts };
}

export function isAllowedSlackPlan(user: SlackConnectedUser) {
  return user.plan === "beta" || user.plan === "pro";
}

function stripSlackMarkup(text: string) {
  return text
    .replace(/<@([A-Z0-9]+)>/g, "@$1")
    .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, "#$2")
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<([^>]+)>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function slackApiFetch<T>(accessToken: string, method: string, params: URLSearchParams) {
  const res = await fetch(`https://slack.com/api/${method}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json().catch(() => ({})) as Promise<T & { ok?: boolean; error?: string }>;
}

export function compactText(value: string, maxLength: number) {
  const text = stripSlackMarkup(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 18).trim()} [trimmed]`;
}

function pickString(value: unknown, keys: string[]): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
}

function extractSearchText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const record = result as Record<string, unknown>;
  const directText = pickString(record, ["content", "text", "snippet", "summary", "title"]);
  const contentText =
    typeof record.content === "object" && record.content
      ? pickString(record.content, ["text", "snippet", "summary", "title"])
      : "";
  const messageText =
    typeof record.message === "object" && record.message
      ? pickString(record.message, ["text", "snippet", "summary"])
      : "";
  const contextRecord = metadataRecord(record.context_messages);
  const contextValues = Array.isArray(record.context_messages)
    ? record.context_messages
    : [
        ...(Array.isArray(contextRecord.before) ? contextRecord.before : []),
        ...(Array.isArray(contextRecord.after) ? contextRecord.after : []),
      ];
  const contextMessages = contextValues
    .map((item) => (typeof item === "object" && item ? pickString(item, ["text", "snippet", "summary", "content"]) : ""))
    .filter(Boolean)
    .join(" / ");

  return [contextMessages, directText, contentText, messageText].filter(Boolean).join(" / ");
}

function extractSearchLabel(result: unknown) {
  if (!result || typeof result !== "object") return "Slack result";
  const record = result as Record<string, unknown>;
  const channel = metadataRecord(record.channel);
  const user = metadataRecord(record.user);
  const channelName = pickString(channel, ["name", "id"]) || pickString(record, ["channel_name", "channel_id"]);
  const userName = pickString(user, ["name", "real_name", "id"]) || pickString(record, ["author_name", "author_user_id", "user_id"]);
  const source = pickString(record, ["source", "type"]);
  return channelName ? `#${channelName}` : userName ? userName : source || "Slack result";
}

function extractSearchPermalink(result: unknown) {
  if (!result || typeof result !== "object") return "";
  return pickString(result, ["permalink"]);
}

function getSearchResults(data: SlackSearchContextResponse | null) {
  if (!data?.ok) return [];
  if (Array.isArray(data.messages)) return data.messages;
  if (data.results && !Array.isArray(data.results) && Array.isArray(data.results.messages)) return data.results.messages;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.matches)) return data.matches;
  if (data.messages && !Array.isArray(data.messages) && Array.isArray(data.messages.matches)) return data.messages.matches;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function buildBroaderSearchQuery(prompt: string, activeContext?: string | null) {
  const base = [prompt, activeContext ? activeContext.replace(/\n/g, " ") : ""].join(" ");
  const withoutSlackSyntax = stripSlackMarkup(base);
  const words = withoutSlackSyntax
    .split(/\s+/)
    .map((word) => word.replace(/[^\w@#.-]/g, ""))
    .filter((word) => word.length > 2);
  const priority = words.filter((word) =>
    /manager|raise|promotion|salary|workload|feedback|priority|project|blocker|review|1:1|one-on-one/i.test(word)
  );
  const names = words.filter((word) => /^[A-Z][a-z]+/.test(word)).slice(0, 6);
  const combined = [...priority, ...names, ...words.slice(0, 18)];
  const deduped = Array.from(new Set(combined)).slice(0, 24).join(" ");
  return deduped || prompt.slice(0, 240);
}

export function isRelationshipHistoryPrompt(prompt: string) {
  return /\b(relationship|history|pattern|vibe|dynamic|overall|usually|typically|how are things with|where.*stand|what.*between us|context with)\b/i.test(prompt);
}

export const SLACK_RELATIONSHIP_LIMITATION_NOTE =
  "I’m working from the visible conversation I could access here. Full Slack history search is coming soon, so relationship insights may be limited for now.";

export function slackNoContextPromptInstruction({
  intent,
  contextFailureReason,
}: {
  intent: SlackCoachingIntent;
  contextFailureReason?: SlackContextFailureReason | null;
}) {
  if (intent === "relationship") {
    switch (contextFailureReason) {
      case "feature_not_enabled":
        return [
          "No Slack relationship context was available.",
          "Say that you tried full Slack history search, but Real-Time Search is not enabled for this workspace/app yet.",
          "Ask the user to send a Slack message link or use Beckett - Decode / Beckett - Respond on a relevant message so you can answer from visible context.",
          "Do not ask for an exact single message as if this were a decode request.",
        ].join(" ");
      case "no_messages":
        return [
          "No Slack relationship context was available.",
          "Say that you tried Slack history search, but it did not return usable messages for this question.",
          "Ask the user to send a Slack message link or use Beckett - Decode / Beckett - Respond on a relevant message so you can answer from visible context.",
          "Do not ask for an exact single message as if this were a decode request.",
        ].join(" ");
      case "missing_scope":
        return [
          "No Slack relationship context was available.",
          "Say that you are missing the Slack permissions needed to search the relevant history.",
          "Tell the user to reconnect Slack from Beckett Settings, then reinstall or reauthorize the Slack app if prompted.",
        ].join(" ");
      case "missing_token":
        return "No Slack relationship context was available. Say Slack is not connected for this account and ask the user to connect Slack from Beckett Settings.";
      default:
        return [
          "No Slack relationship context was available.",
          "Say that you could not find readable Slack context for this relationship question.",
          "Ask the user to send a Slack message link or use Beckett - Decode / Beckett - Respond on a relevant message so you can answer from visible context.",
        ].join(" ");
    }
  }

  if (isCompactSlackIntent(intent)) {
    return "No recent Slack context was available. If the user did not provide message text, say exactly: I could not read this Slack conversation. Paste or paraphrase the message and I’ll help.";
  }

  return "No recent Slack context was available. Answer from the user's request without implying you saw surrounding messages.";
}

// Kept for a separately reviewed future broader-access release; unreachable in zero-copy launch.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildTargetedBroaderSearchQuery({
  prompt,
  activeContext,
  slackUserId,
}: {
  prompt: string;
  activeContext?: string | null;
  slackUserId: string;
}) {
  const base = buildBroaderSearchQuery(prompt, activeContext);
  return `with:<@${slackUserId}> ${base}`.trim();
}

export async function lookupSlackUserProfile(accessToken: string, userId: string) {
  const cacheKey = `${accessToken.slice(-8)}:${userId}`;
  const cached = slackUserNameCache.get(cacheKey);
  if (cached) return { id: userId, name: cached, aliases: [cached], resolved: cached !== "Slack user" };

  const data = await slackApiFetch<SlackUserInfo>(
    accessToken,
    "users.info",
    new URLSearchParams({ user: userId })
  ).catch(() => null);
  const resolvedName =
    data?.user?.profile?.display_name ||
    data?.user?.profile?.real_name ||
    data?.user?.real_name ||
    data?.user?.name ||
    "";
  const name = resolvedName && !/^U[A-Z0-9]+$/i.test(resolvedName) ? resolvedName : "Slack user";
  const aliases = Array.from(
    new Set(
      [
        data?.user?.profile?.display_name,
        data?.user?.profile?.real_name,
        data?.user?.real_name,
        data?.user?.name,
        resolvedName,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

  slackUserNameCache.set(cacheKey, name);
  if (!resolvedName) {
    console.warn("Slack user profile name unavailable", {
      userPresent: Boolean(userId),
      error: data?.error || "missing_profile_name",
    });
  }
  return { id: data?.user?.id || userId, name, aliases, resolved: Boolean(resolvedName) };
}

async function lookupSlackUserName(accessToken: string, userId: string) {
  const profile = await lookupSlackUserProfile(accessToken, userId);
  return profile.name;
}

async function formatSlackHistoryMessage(accessToken: string, message: SlackHistoryMessage) {
  const text = stripSlackMarkup(message.text || "");
  if (!text) return null;

  const author = message.user
    ? await lookupSlackUserName(accessToken, message.user)
    : message.username || (message.bot_id ? "App or workflow" : "Someone");

  const reactions = await Promise.all((message.reactions || []).map(async (reaction) => {
    const names = await Promise.all((reaction.users || []).slice(0, 8).map((userId) => lookupSlackUserName(accessToken, userId)));
    const label = reaction.name ? `:${reaction.name}:` : "reaction";
    if (names.length) return `${label} from ${names.join(", ")}`;
    return `${label} ×${reaction.count || 1}`;
  }));
  return `${author}: ${text}${reactions.length ? ` [Reactions: ${reactions.join("; ")}]` : ""}`;
}

export async function fetchSlackConversationContext({
  accessToken,
  channelId,
  channelName,
  messageTs,
  threadTs,
}: {
  accessToken: string | null;
  channelId?: string | null;
  channelName?: string | null;
  messageTs?: string | null;
  threadTs?: string | null;
}) {
  if (!accessToken) return slackUnavailable("missing_token");
  if (!channelId) return slackUnavailable("missing_channel");

  const fetchRecentHistory = () => {
    const params = new URLSearchParams({
      channel: channelId,
      limit: String(MAX_SLACK_CONTEXT_MESSAGES),
      inclusive: "true",
    });
    if (messageTs && !threadTs) params.set("latest", messageTs);
    return slackApiFetch<{ messages?: SlackHistoryMessage[] }>(
      accessToken,
      "conversations.history",
      params
    ).catch(() => null);
  };

  const fetchThreadReplies = (replyTs: string) =>
    slackApiFetch<{ messages?: SlackHistoryMessage[] }>(
        accessToken,
        "conversations.replies",
        new URLSearchParams({
          channel: channelId,
          ts: replyTs,
          limit: String(MAX_SLACK_CONTEXT_MESSAGES),
          inclusive: "true",
        })
      ).catch(() => null);

  // A Beckett root thread is a hard conversation boundary. Pulling recent DM
  // history here allowed unrelated roots to enter an otherwise exact thread.
  const historyData = threadTs ? null : await fetchRecentHistory();
  const replyTs = threadTs || null;
  const replyData = replyTs ? await fetchThreadReplies(replyTs) : null;
  const fallbackReplyData =
    !replyData && messageTs && (!historyData?.ok || (Array.isArray(historyData.messages) && historyData.messages.length <= 1))
      ? await fetchThreadReplies(messageTs)
      : null;

  const reasonFor = (data: { ok?: boolean; error?: string } | null | undefined): SlackContextFailureReason => {
    if (data?.error === "missing_scope") return "missing_scope";
    if (data?.error === "not_in_channel") return "not_in_channel";
    if (data?.error === "channel_not_found") return "channel_not_found";
    return "slack_api_error";
  };

  const formatMessages = async (messages: SlackHistoryMessage[] | undefined) =>
    (
      await Promise.all((messages || []).slice().reverse().map((message) => formatSlackHistoryMessage(accessToken, message)))
    ).filter(Boolean) as string[];

  const historyMessages = historyData?.ok ? await formatMessages(historyData.messages) : [];
  const threadMessages = replyData?.ok
    ? await formatMessages(replyData.messages)
    : fallbackReplyData?.ok
      ? await formatMessages(fallbackReplyData.messages)
      : [];
  const relevantUserIds = uniqueSlackUserIds([
    ...slackUserIdsFromMessages(historyData?.messages || []),
    ...slackUserIdsFromMessages(replyData?.messages || []),
    ...slackUserIdsFromMessages(fallbackReplyData?.messages || []),
  ]);

  if (!historyMessages.length && !threadMessages.length) {
    const failedData = historyData && !historyData.ok ? historyData : replyData && !replyData.ok ? replyData : fallbackReplyData;
    const reason = failedData ? reasonFor(failedData) : "no_messages";
    return slackUnavailable(reason);
  }

  const label = channelName ? `#${channelName}` : "this Slack conversation";
  const sections: string[] = [];
  const seen = new Set<string>();

  const addSection = (heading: string, lines: string[]) => {
    const unique = lines.filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length) sections.push([heading, ...unique].join("\n"));
  };

  addSection(`Recent Slack context from ${label} (oldest to newest):`, historyMessages);
  addSection(`Slack thread context from ${label} (oldest to newest):`, threadMessages);

  const context = sections.join("\n\n");
  const messageCount = seen.size;
  const retrievalMethod =
    historyMessages.length && threadMessages.length
      ? "history_and_replies"
      : threadMessages.length
        ? "replies"
        : "history";
  return {
    text:
      context.length <= MAX_SLACK_CONTEXT_LENGTH
        ? context
        : `${context.slice(0, MAX_SLACK_CONTEXT_LENGTH - 40).trim()}\n[Context trimmed]`,
    status: "available",
    failureReason: null,
    messageCount,
    retrievalMethod,
    relevantUserIds,
  } satisfies SlackConversationContext;
}

export async function fetchSlackThreadSnapshot({
  accessToken,
  channelId,
  threadTs,
  currentSlackUserId,
  limit = 100,
}: {
  accessToken: string | null;
  channelId?: string | null;
  threadTs?: string | null;
  currentSlackUserId?: string | null;
  limit?: number;
}): Promise<SlackThreadSnapshot> {
  if (!accessToken) return { status: "unavailable", failureReason: "missing_token", turns: [] };
  if (!channelId || !threadTs) return { status: "unavailable", failureReason: "missing_channel", turns: [] };

  const data = await slackApiFetch<{ messages?: SlackHistoryMessage[] }>(
    accessToken,
    "conversations.replies",
    new URLSearchParams({
      channel: channelId,
      ts: threadTs,
      limit: String(Math.min(100, Math.max(1, limit))),
      inclusive: "true",
    })
  ).catch(() => null);

  if (!data?.ok) {
    return {
      status: "unavailable",
      failureReason: slackContextFailureReasonForError(data?.error),
      turns: [],
    };
  }

  const turns = (data.messages || [])
    .map((message): SlackThreadTurn | null => {
      const text = stripSlackMarkup(message.text || "").trim();
      if (!text) return null;
      const role = message.user === currentSlackUserId
        ? "user"
        : message.bot_id || message.subtype === "bot_message"
          ? "beckett"
          : "other";
      return {
        role,
        userId: message.user || null,
        text,
        ts: message.ts || null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(left!.ts || 0) - Number(right!.ts || 0)) as SlackThreadTurn[];

  return {
    status: turns.length ? "available" : "unavailable",
    failureReason: turns.length ? null : "no_messages",
    turns,
  };
}

export function formatSlackThreadSnapshot(snapshot: SlackThreadSnapshot, maxLength = 6000) {
  const transcript = snapshot.turns
    .map((turn) => `${turn.role === "user" ? "User" : turn.role === "beckett" ? "Beckett" : "Other participant"}: ${turn.text}`)
    .join("\n\n");
  if (transcript.length <= maxLength) return transcript;
  return transcript.slice(-maxLength);
}

export async function fetchLatestSlackMessageContext({
  accessToken,
  channelId,
  channelName,
  currentSlackUserId,
}: {
  accessToken: string | null;
  channelId?: string | null;
  channelName?: string | null;
  currentSlackUserId?: string | null;
}): Promise<SlackLatestMessageContext | null> {
  if (!accessToken || !channelId) return null;

  const data = await slackApiFetch<{ messages?: SlackHistoryMessage[] }>(
    accessToken,
    "conversations.history",
    new URLSearchParams({
      channel: channelId,
      limit: String(MAX_SLACK_CONTEXT_MESSAGES),
      inclusive: "true",
    })
  ).catch(() => null);

  if (!data?.ok || !Array.isArray(data.messages) || !data.messages.length) return null;
  const currentUserId = normalizeSlackUserId(currentSlackUserId);
  const target = data.messages.find((message) => {
    if (!message?.text || message.bot_id || message.subtype) return false;
    if (currentUserId && message.user === currentUserId) return false;
    return Boolean(stripSlackMarkup(message.text).trim());
  }) || data.messages.find((message) => message?.text && !message.bot_id && !message.subtype);

  if (!target?.text) return null;

  const context = await fetchSlackConversationContext({
    accessToken,
    channelId,
    channelName,
    messageTs: target.ts,
    threadTs: target.thread_ts,
  });

  return {
    targetText: stripSlackMarkup(target.text),
    targetTs: target.ts || null,
    context,
  };
}

export async function buildGuestSlackContextPacket({
  botAccessToken,
  channelId,
  channelName,
  selectedMessageText,
  selectedMessageTs,
  threadTs,
  latestMessageText,
  currentSlackUserId,
  userRequest,
}: {
  botAccessToken: string | null;
  channelId?: string | null;
  channelName?: string | null;
  selectedMessageText?: string | null;
  selectedMessageTs?: string | null;
  threadTs?: string | null;
  latestMessageText?: string | null;
  currentSlackUserId?: string | null;
  userRequest?: string | null;
}) {
  const sections: string[] = [];
  const selected = selectedMessageText?.trim();
  const latest = latestMessageText?.trim();
  const request = userRequest?.trim();
  if (selected) sections.push(["Selected Slack message:", selected].join("\n"));
  if (!selected && latest) sections.push(["Target latest Slack message:", latest].join("\n"));
  if (request) sections.push(["User request:", request].join("\n"));

  let context: SlackConversationContext | null = null;
  if (
    botAccessToken &&
    channelId &&
    shouldLoadGuestConversationContext({ selectedMessageText, selectedMessageTs, threadTs, latestMessageText })
  ) {
    context = selectedMessageTs || threadTs
      ? await fetchSlackConversationContext({
          accessToken: botAccessToken,
          channelId,
          channelName,
          messageTs: selectedMessageTs,
          threadTs,
        })
      : (await fetchLatestSlackMessageContext({
          accessToken: botAccessToken,
          channelId,
          channelName,
          currentSlackUserId,
        }))?.context || await fetchSlackConversationContext({
          accessToken: botAccessToken,
          channelId,
          channelName,
        });
  }

  if (context?.text) sections.push(["Surrounding Slack context:", context.text].join("\n"));
  else if (selected || latest) {
    sections.push("I’m working from the message I could see because I couldn’t read the surrounding conversation.");
  }

  return {
    text: sections.filter(Boolean).join("\n\n"),
    context,
    messageCount: context?.messageCount || 0,
    contextStatus: context?.status || (selected || latest || request ? "available" : "unavailable"),
    contextFailureReason: context?.failureReason || null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function runSlackBroaderSearch({
  accessToken,
  query,
  contextChannelId,
  actionToken,
  strategy,
}: {
  accessToken: string;
  query: string;
  contextChannelId?: string | null;
  actionToken?: string | null;
  strategy: string;
}) {
  const body: Record<string, unknown> = {
    query,
    content_types: ["messages"],
    channel_types: ["public_channel", "private_channel", "mpim", "im"],
    include_context_messages: true,
    limit: MAX_SLACK_BROAD_CONTEXT_RESULTS,
  };
  if (contextChannelId) body.context_channel_id = contextChannelId;
  if (actionToken) body.action_token = actionToken;

  const data = await slackApiPost<SlackSearchContextResponse>(accessToken, "assistant.search.context", body).catch(
    () => null
  );
  const method = `assistant.search.context ${strategy}`;
  if (!data?.ok) {
    console.warn("Slack RTS search.context unavailable", {
      strategy,
      error: data?.error || "request_failed",
      contextChannelPresent: Boolean(contextChannelId),
      actionTokenPresent: Boolean(actionToken),
    });
    return slackUnavailable(
      slackContextFailureReasonForError(data?.error),
      `${method}${data?.error ? ` error:${data.error}` : " request_failed"}`
    );
  }

  const results = getSearchResults(data);
  console.info("Slack RTS search.context result", {
    ok: true,
    strategy,
    resultCount: results.length,
    contextChannelPresent: Boolean(contextChannelId),
    actionTokenPresent: Boolean(actionToken),
  });
  if (!results.length) return slackUnavailable("no_messages", `${method} no_results`);

  const formatted = results
    .map((result) => {
      const text = compactText(extractSearchText(result), 380);
      if (!text) return null;
      return `${extractSearchLabel(result)}: ${text}`;
    })
    .filter(Boolean)
    .slice(0, MAX_SLACK_BROAD_CONTEXT_RESULTS) as string[];

  if (!formatted.length) return slackUnavailable("no_messages", `${method} parser_empty`);

  const context = ["Relevant prior Slack history from live search:", ...formatted].join("\n");
  return {
    text:
      context.length <= MAX_SLACK_BROAD_CONTEXT_LENGTH
        ? context
        : `${context.slice(0, MAX_SLACK_BROAD_CONTEXT_LENGTH - 40).trim()}\n[Broader context trimmed]`,
    status: "available",
    failureReason: null,
    messageCount: formatted.length,
    broaderSearchUsed: true,
    retrievalMethod: method,
  } satisfies SlackConversationContext;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function runLegacySlackMessageSearch({
  accessToken,
  query,
}: {
  accessToken: string;
  query: string;
}) {
  const data = await slackApiFetch<SlackLegacySearchResponse>(
    accessToken,
    "search.messages",
    new URLSearchParams({ query, count: String(MAX_SLACK_BROAD_CONTEXT_RESULTS), sort: "score" })
  ).catch(() => null);
  const method = "search.messages fallback";
  if (!data?.ok) {
    console.warn("Slack message search fallback unavailable", {
      error: data?.error || "request_failed",
    });
    return slackUnavailable(slackContextFailureReasonForError(data?.error), `${method} error:${data?.error || "request_failed"}`);
  }

  const results = Array.isArray(data.messages?.matches) ? data.messages.matches : [];
  const formatted = results
    .map((result) => {
      const text = compactText(extractSearchText(result), 380);
      if (!text) return null;
      const permalink = extractSearchPermalink(result);
      return `${extractSearchLabel(result)}: ${text}${permalink ? ` (${permalink})` : ""}`;
    })
    .filter(Boolean)
    .slice(0, MAX_SLACK_BROAD_CONTEXT_RESULTS) as string[];
  if (!formatted.length) return slackUnavailable("no_messages", `${method} no_results`);

  const context = ["Relevant prior Slack history from live search:", ...formatted].join("\n");
  return {
    text: context.length <= MAX_SLACK_BROAD_CONTEXT_LENGTH
      ? context
      : `${context.slice(0, MAX_SLACK_BROAD_CONTEXT_LENGTH - 40).trim()}\n[Broader context trimmed]`,
    status: "available",
    failureReason: null,
    messageCount: formatted.length,
    broaderSearchUsed: true,
    retrievalMethod: method,
  } satisfies SlackConversationContext;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchSlackRealTimeSearchInfo(accessToken: string | null) {
  if (!accessToken) {
    return {
      ok: false,
      available: false,
      error: "missing_token",
      isAiSearchEnabled: false,
    };
  }

  const data = await slackApiPost<SlackSearchInfoResponse>(accessToken, "assistant.search.info", {}).catch(
    (error) => {
      console.error("Slack RTS search.info request failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  );
  const info = {
    ok: Boolean(data?.ok),
    available: Boolean(data?.ok),
    error: data?.error || null,
    isAiSearchEnabled: Boolean(data?.is_ai_search_enabled),
  };
  console.info("Slack RTS search.info", info);
  return info;
}

export async function fetchSlackBroaderContext({
  accessToken,
  prompt,
  activeContext,
  contextChannelId,
  actionToken,
  relevantSlackUserIds = [],
  currentSlackUserId,
}: {
  accessToken: string | null;
  prompt: string;
  activeContext?: string | null;
  contextChannelId?: string | null;
  actionToken?: string | null;
  relevantSlackUserIds?: string[];
  currentSlackUserId?: string | null;
}) {
  void accessToken;
  void prompt;
  void activeContext;
  void contextChannelId;
  void actionToken;
  void relevantSlackUserIds;
  void currentSlackUserId;
  return slackUnavailable("feature_not_enabled", "zero_copy_launch_scope_policy");

  /* Broad workspace search is intentionally disabled for the zero-copy launch.
  if (!accessToken) return slackUnavailable("missing_token");

  const rtsInfo = await fetchSlackRealTimeSearchInfo(accessToken);
  if (!rtsInfo.available) {
    const unavailable = slackUnavailable(
      slackContextFailureReasonForError(rtsInfo.error),
      `assistant.search.info error:${rtsInfo.error || "unavailable"}`
    );
    if (unavailable.failureReason === "feature_not_enabled") {
      const fallback = await runLegacySlackMessageSearch({
        accessToken,
        query: buildBroaderSearchQuery(prompt, activeContext),
      });
      if (fallback.status === "available") return fallback;
      unavailable.retrievalMethod = [unavailable.retrievalMethod, fallback.retrievalMethod].filter(Boolean).join("; ");
    }
    return unavailable;
  }

  const normalizedUserIds = uniqueSlackUserIds(relevantSlackUserIds);
  const currentUserId = normalizeSlackUserId(currentSlackUserId);
  const orderedUserIds =
    currentUserId && normalizedUserIds.some((id) => id !== currentUserId)
      ? [...normalizedUserIds.filter((id) => id !== currentUserId), currentUserId]
      : normalizedUserIds;
  const relationshipSearch = isRelationshipHistoryPrompt(prompt);
  const attempted: string[] = [];
  let firstFailure: SlackConversationContext | null = null;
  if (relationshipSearch && orderedUserIds.length) {
    for (const userId of orderedUserIds.slice(0, 3)) {
      const targeted = await runSlackBroaderSearch({
        accessToken,
        query: buildTargetedBroaderSearchQuery({ prompt, activeContext, slackUserId: userId }),
        contextChannelId,
        actionToken,
        strategy: `with:<@${userId}>`,
      });
      if (targeted.status === "available") return targeted;
      attempted.push(targeted.retrievalMethod || `assistant.search.context with:<@${userId}>`);
      firstFailure ||= targeted;
      if (targeted.failureReason === "missing_scope") {
        return targeted;
      }
    }
  }

  const generic = await runSlackBroaderSearch({
    accessToken,
    query: buildBroaderSearchQuery(prompt, activeContext),
    contextChannelId,
    actionToken,
    strategy: relationshipSearch && orderedUserIds.length ? "generic_fallback" : "generic",
  });
  if (generic.status === "available") return generic;
  if (generic.failureReason === "feature_not_enabled" || generic.failureReason === "no_messages") {
    const fallback = await runLegacySlackMessageSearch({
      accessToken,
      query: buildBroaderSearchQuery(prompt, activeContext),
    });
    if (fallback.status === "available") return fallback;
    generic.retrievalMethod = [generic.retrievalMethod, fallback.retrievalMethod].filter(Boolean).join("; ");
  }
  if (attempted.length) {
    return slackUnavailable(
      generic.failureReason || firstFailure?.failureReason || "no_messages",
      [...attempted, generic.retrievalMethod || "assistant.search.context generic"].join("; ")
    );
  }

  return generic; */
}

export async function buildSlackCoachingContext({
  user,
  prompt,
  activeContext,
  contextChannelId,
  actionToken,
  includeBroaderContext = true,
  relevantSlackUserIds = [],
  currentSlackUserId,
}: {
  user: SlackConnectedUser;
  prompt: string;
  activeContext?: SlackConversationContext | null;
  contextChannelId?: string | null;
  actionToken?: string | null;
  includeBroaderContext?: boolean;
  relevantSlackUserIds?: string[];
  currentSlackUserId?: string | null;
}) {
  const broaderContext = includeBroaderContext
    ? await fetchSlackBroaderContext({
        accessToken: user.accessToken,
        prompt,
        activeContext: activeContext?.text,
        contextChannelId,
        actionToken,
        relevantSlackUserIds: uniqueSlackUserIds([
          ...(activeContext?.relevantUserIds || []),
          ...relevantSlackUserIds,
        ]),
        currentSlackUserId,
      })
    : slackUnavailable("no_messages");

  const sections = [
    activeContext?.text ? `Active Slack context:\n${activeContext.text}` : "",
    broaderContext.text ? `Relevant prior Slack history:\n${broaderContext.text}` : "",
  ].filter(Boolean);
  const primaryStatus: SlackContextStatus =
    activeContext?.status === "available" || broaderContext.status === "available" ? "available" : "unavailable";
  const failureReason =
    primaryStatus === "available"
      ? broaderContext.status === "unavailable"
        ? broaderContext.failureReason
        : activeContext?.failureReason || null
      : broaderContext.failureReason || activeContext?.failureReason || "slack_api_error";

  return {
    text: sections.join("\n\n") || null,
    status: primaryStatus,
    failureReason,
    messageCount: (activeContext?.messageCount || 0) + (broaderContext.messageCount || 0),
    broaderSearchUsed: broaderContext.status === "available",
    activeContext,
    broaderContext,
  };
}

export async function resolveSlackAuthorRelationshipContext({
  user,
  teamId,
  slackAuthorUserId,
  interactionType,
}: {
  user: SlackConnectedUser;
  teamId: string;
  slackAuthorUserId?: string | null;
  interactionType: string;
}) {
  void interactionType;
  const identifier = slackUserIdentifier(teamId, slackAuthorUserId);
  if (!identifier) return null;

  const slackProfile =
    user.accessToken && slackAuthorUserId
      ? await lookupSlackUserProfile(user.accessToken, slackAuthorUserId).catch(() => null)
      : null;
  let relationshipContext = await lookupRelationshipContextByIdentifier({
    userId: user.id,
    identifier,
    requireConfirmed: true,
  });

  for (const alias of slackProfile?.aliases || []) {
    if (relationshipContext) break;
    relationshipContext = await lookupRelationshipContextByIdentifier({
      userId: user.id,
      identifier: {
        platform: "slack",
        identifier: alias,
        confirmed: false,
      },
      requireConfirmed: false,
    });
  }

  if (!relationshipContext) {
    return {
      linked: false,
      slackProfile,
      slackIdentifier: identifier.identifier,
      promptContext: null,
    };
  }

  return {
    linked: true,
    slackProfile,
    slackIdentifier: identifier.identifier,
    contact: relationshipContext.contact,
    promptContext: relationshipContext.promptContext,
  };
}

export function slackContextUserNote(context: SlackConversationContext) {
  if (context.status === "available") return "";
  switch (context.failureReason) {
    case "missing_scope":
      return "How to resolve: I’m missing the Slack permissions needed to read this context. Reconnect Slack from Beckett Settings, then reinstall or reauthorize the Slack app if prompted.";
    case "feature_not_enabled":
      return "How to resolve: Slack broader search is not enabled for this app or workspace yet. I can still use the active conversation and linked Slack threads.";
    case "not_in_channel":
      return "How to resolve: I do not have access to this channel or DM. Add Beckett to the channel or use a conversation Beckett is authorized to read.";
    case "channel_not_found":
      return "How to resolve: I could not find that Slack channel or conversation. Check that the link is from the connected workspace.";
    case "no_messages":
      return "How to resolve: I could open the conversation, but Slack did not return readable messages. Try linking a specific message or thread.";
    case "missing_token":
      return "How to resolve: Slack is not connected for this account. Connect Slack from Beckett Settings.";
    default:
      return "How to resolve: Slack returned an error while I was trying to read context. Try again, or reconnect Slack if this keeps happening.";
  }
}
