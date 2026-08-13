import { NextRequest, NextResponse } from "next/server";
import {
  buildAskedResponsePayload,
  buildBeckettPayload,
  buildGuestSlackContextPacket,
  buildSlackCoachingContext,
  fetchSlackConversationContext,
  fetchSlackThreadSnapshot,
  formatSlackThreadSnapshot,
  handleSlackAiError,
  isAllowedSlackPlan,
  lookupSlackConnectedUser,
  lookupSlackUserProfile,
  lookupSlackWorkspaceBotToken,
  postSlackAgentMessage,
  postSlackResponse,
  resolveSlackAuthorRelationshipContext,
  runSlackGuestCoaching,
  runSlackCoaching,
  scheduleSlackBackgroundTask,
  shouldUseBroaderSlackContext,
  slackApiPost,
  slackConnectText,
  SlackBlock,
  SlackCoachingIntent,
  SLACK_SLASH_LONGER_ACTION_ID,
  SLACK_SLASH_QUICK_ACTION_ID,
  SlackResponseDetail,
  setSlackAgentSuggestedPrompts,
  verifySlackRequest,
} from "@/lib/slack-app";
import {
  createSlackDraftActionSession,
  extractSlackDraftOptions,
  SLACK_DRAFT_CANCEL_ACTION_ID,
  SLACK_DRAFT_SEND_ACTION_ID,
  SLACK_DRAFT_USE_ACTION_ID,
  startGuidedSlackFlow,
  SlackDraftOption,
} from "@/lib/slack-guided-prep";
import {
  archiveSlackCoachingThread,
  appendSlackCoachingMessage,
  buildSlackExplainMoreAction,
  buildSlackHistoryContinuePayload,
  buildSlackStartCardPayload,
  buildSlackThreadArchiveAction,
  cancelSlackInactivityStartCard,
  createSlackCoachingThread,
  loadSlackCoachingMessages,
  loadSlackCoachingThread,
  parseSlackHistoryAction,
  publishSlackHome,
  recordSlackCoachingBotMessage,
  saveSlackGuestPrepState,
  saveSlackGuestSelectedMessageState,
  scheduleSlackInactivityStartCard,
  slackHistoryTitle,
  SLACK_HISTORY_EXPLAIN_MORE_ACTION_ID,
  SLACK_HISTORY_ARCHIVE_ACTION_ID,
  SLACK_HISTORY_CONTINUE_ACTION_ID,
  SLACK_HISTORY_QUICK_ACTION_ID,
  SLACK_GUEST_PREP_PRACTICE_ACTION_ID,
  SlackHistoryFlowType,
  summarizeSlackCoachingResponse,
} from "@/lib/slack-history";
import { slackRepository } from "@/lib/repositories/slack-repository";
import { startSlackGuestSession } from "@/lib/slack-guest-session";
import { startGuestPracticeFromPrep } from "@/lib/slack-guest-practice";
import {
  buildShortcutPrompt,
  extractMessageText,
  messageShortcutIntent,
  parseInteractionPayload,
  selectedMessageOpener,
  type MessageShortcutIntent,
  type SlackInteractionPayload,
} from "@/features/slack/interaction-contracts";
import { cancelGuestInactivityStartCard } from './history-actions';

type SlackDraftActionValue = {
  sessionId?: string;
  optionId?: SlackDraftOption["id"];
  draftText?: string;
};

type SlackPendingRequest = {
  id: string;
  user_id: string;
  slack_team_id: string;
  slack_user_id: string;
  slack_channel_id: string | null;
  slack_channel_name: string | null;
  prompt: string;
  response_url: string | null;
  expires_at: string;
  completed_at: string | null;
};

export function parseSlashActionValue(value: string): { requestId: string; intent: SlackCoachingIntent } | null {
  try {
    const parsed = JSON.parse(value) as { requestId?: unknown; intent?: unknown };
    if (typeof parsed.requestId !== "string") return null;
    const validIntents: SlackCoachingIntent[] = [
      "rewrite",
      "decode",
      "draft",
      "prep",
      "tone",
      "followup",
      "respond",
      "clarity",
      "boundary",
      "practice",
    ];
    const intent = validIntents.includes(parsed.intent as SlackCoachingIntent)
      ? (parsed.intent as SlackCoachingIntent)
      : "general";

    return { requestId: parsed.requestId, intent };
  } catch {
    return { requestId: value, intent: "general" };
  }
}

export function getSlashDetailAction(payload: SlackInteractionPayload) {
  const action = payload.actions?.find((item) =>
    item.action_id === SLACK_SLASH_QUICK_ACTION_ID || item.action_id === SLACK_SLASH_LONGER_ACTION_ID
  );
  if (!action?.value || !action.action_id) return null;
  const parsedValue = parseSlashActionValue(action.value);
  if (!parsedValue) return null;

  return {
    requestId: parsedValue.requestId,
    intent: parsedValue.intent,
    responseDetail: action.action_id === SLACK_SLASH_LONGER_ACTION_ID ? "longer" : "quick",
  } satisfies { requestId: string; responseDetail: SlackResponseDetail; intent: SlackCoachingIntent };
}

export function getDraftAction(payload: SlackInteractionPayload) {
  const action = payload.actions?.find((item) =>
    item.action_id === SLACK_DRAFT_USE_ACTION_ID ||
    item.action_id === SLACK_DRAFT_SEND_ACTION_ID ||
    item.action_id === SLACK_DRAFT_CANCEL_ACTION_ID
  );
  if (!action?.action_id || !action.value) return null;

  try {
    const parsed = JSON.parse(action.value) as SlackDraftActionValue;
    if (!parsed.sessionId || !parsed.optionId) return null;
    return {
      actionId: action.action_id,
      sessionId: parsed.sessionId,
      optionId: parsed.optionId,
      draftText: parsed.draftText,
    };
  } catch {
    return null;
  }
}

export function getHistoryAction(payload: SlackInteractionPayload) {
  const action = payload.actions?.find((item) =>
    item.action_id === SLACK_HISTORY_CONTINUE_ACTION_ID ||
    item.action_id === SLACK_HISTORY_EXPLAIN_MORE_ACTION_ID ||
    item.action_id === SLACK_HISTORY_ARCHIVE_ACTION_ID ||
    item.action_id?.startsWith(SLACK_HISTORY_QUICK_ACTION_ID)
  );
  if (!action?.action_id) return null;
  const parsed = parseSlackHistoryAction(action.value);
  return {
    actionId: action.action_id,
    threadId: parsed?.threadId,
    flowType: parsed?.flowType,
  };
}

export function getGuestPrepPracticeAction(payload: SlackInteractionPayload) {
  const action = payload.actions?.find((item) => item.action_id === SLACK_GUEST_PREP_PRACTICE_ACTION_ID);
  if (!action?.value) return null;
  try {
    const parsed = JSON.parse(action.value) as { prepThreadTs?: string; direct?: boolean };
    return parsed.prepThreadTs ? { prepThreadTs: parsed.prepThreadTs, direct: Boolean(parsed.direct) } : null;
  } catch {
    return null;
  }
}

export async function handleGuestPrepPracticeAction({
  payload,
  prepThreadTs,
}: {
  payload: SlackInteractionPayload;
  prepThreadTs: string;
}) {
  const teamId = payload.team?.id || "";
  const slackUserId = payload.user?.id || "";
  const channelId = payload.channel?.id || "";
  if (!teamId || !slackUserId || !channelId) return;
  await startGuestPracticeFromPrep({ teamId, slackUserId, channelId, prepThreadTs });
}

export function detailLabel(responseDetail: SlackResponseDetail) {
  return responseDetail === "longer" ? "longer explanation" : "quick answer";
}

export async function replaceSlackInteraction(responseUrl: string, text: string, blocks?: SlackBlock[]) {
  await postSlackResponse(responseUrl, text, {
    replaceOriginal: true,
    blocks,
  });
}

export async function loadPendingRequest(requestId: string) {
  const { data, error } = await slackRepository
    .from("slack_pending_requests")
    .select(
      "id, user_id, slack_team_id, slack_user_id, slack_channel_id, slack_channel_name, prompt, response_url, expires_at, completed_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  return data as SlackPendingRequest | null;
}

export async function loadDraftSession({
  sessionId,
  teamId,
  slackUserId,
}: {
  sessionId: string;
  teamId: string;
  slackUserId: string;
}) {
  const { data, error } = await slackRepository
    .from("slack_agent_sessions")
    .select("id, user_id, slack_team_id, slack_user_id, slack_channel_id, thread_ts, flow_type, status, answers, zero_copy_flow_session_id")
    .eq("id", sessionId)
    .eq("slack_team_id", teamId)
    .eq("slack_user_id", slackUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row = data as
    | {
        id: string;
        user_id: string;
        slack_team_id: string;
        slack_user_id: string;
        slack_channel_id: string;
        thread_ts: string | null;
        flow_type: string;
        status: string;
        zero_copy_flow_session_id?: string | null;
        answers: {
          source_channel_id?: string;
          source_channel_name?: string;
          source_thread_ts?: string;
          draft_options?: SlackDraftOption[];
        };
      }
    | null;
  if (!row) return null;
  const { data: flow, error: flowError } = row.zero_copy_flow_session_id
    ? await slackRepository
        .from("slack_flow_sessions")
        .select("slack_source_channel_id, slack_source_thread_ts")
        .eq("id", row.zero_copy_flow_session_id)
        .eq("slack_team_id", teamId)
        .eq("slack_user_id", slackUserId)
        .maybeSingle()
    : { data: null, error: null };
  if (flowError) throw flowError;
  return {
    ...row,
    answers: {
      ...(row.answers || {}),
      source_channel_id: flow?.slack_source_channel_id || row.answers?.source_channel_id,
      source_thread_ts: flow?.slack_source_thread_ts || row.answers?.source_thread_ts,
    },
  };
}

export function draftDestinationLabel(answers: {
  source_channel_id?: string;
  source_channel_name?: string;
  source_thread_ts?: string;
}) {
  const channel = answers.source_channel_name ? `#${answers.source_channel_name}` : "the original Slack conversation";
  return answers.source_thread_ts ? `${channel} thread` : channel;
}

export function buildDraftActionValue(sessionId: string, optionId: SlackDraftOption["id"], draftText?: string) {
  return JSON.stringify({ sessionId, optionId, ...(draftText ? { draftText } : {}) });
}

export function buildDraftConfirmationPayload({
  sessionId,
  option,
  destination,
}: {
  sessionId: string;
  option: SlackDraftOption;
  destination: string;
}) {
  return buildBeckettPayload({
    title: "Beckett",
    subtitle: "Confirm before sending",
    body: [
      `Selected draft: ${option.label}`,
      "",
      option.text,
      "",
      `Destination: ${destination}`,
      "",
      "Nothing posts publicly unless you confirm.",
    ].join("\n"),
    hideTitle: true,
    actions: [
      {
        type: "button",
        text: { type: "plain_text", text: "Send to Slack" },
        style: "primary",
        action_id: SLACK_DRAFT_SEND_ACTION_ID,
        value: buildDraftActionValue(sessionId, option.id, option.text),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Cancel" },
        action_id: SLACK_DRAFT_CANCEL_ACTION_ID,
        value: buildDraftActionValue(sessionId, option.id, option.text),
      },
    ],
  });
}

export async function claimPendingRequest({
  requestId,
  teamId,
  slackUserId,
}: {
  requestId: string;
  teamId: string;
  slackUserId: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await slackRepository
    .from("slack_pending_requests")
    .update({ completed_at: now })
    .eq("id", requestId)
    .eq("slack_team_id", teamId)
    .eq("slack_user_id", slackUserId)
    .is("completed_at", null)
    .gt("expires_at", now)
    .select(
      "id, user_id, slack_team_id, slack_user_id, slack_channel_id, slack_channel_name, prompt, response_url, expires_at, completed_at"
    )
    .maybeSingle();

  if (error) throw error;
  if (data) return { pending: data as SlackPendingRequest, message: null };

  const existing = await loadPendingRequest(requestId);
  if (!existing) {
    return { pending: null, message: "That Beckett request is no longer available. Please run `/beckett` again." };
  }
  if (existing.slack_team_id !== teamId || existing.slack_user_id !== slackUserId) {
    return { pending: null, message: "That Beckett request belongs to another Slack user." };
  }
  if (existing.completed_at) {
    return { pending: null, message: "I already answered that Beckett request. Run `/beckett` again for a new one." };
  }
  if (new Date(existing.expires_at).getTime() <= Date.now()) {
    return { pending: null, message: "That Beckett request expired. Please run `/beckett` again." };
  }
  return { pending: null, message: "I could not open that Beckett request. Please run `/beckett` again." };
}

export async function sendPendingSlashResponse({
  origin,
  payload,
  requestId,
  responseDetail,
  intent,
}: {
  origin: string;
  payload: SlackInteractionPayload;
  requestId: string;
  responseDetail: SlackResponseDetail;
  intent: SlackCoachingIntent;
}) {
  const teamId = payload.team?.id || "";
  const slackUserId = payload.user?.id || "";
  const initialResponseUrl = payload.response_url || "";

  try {
    console.info("Slack slash button background started", {
      requestId,
      intent,
      responseDetail,
      hasResponseUrl: Boolean(initialResponseUrl),
      teamPresent: Boolean(teamId),
      userPresent: Boolean(slackUserId),
    });

    if (!teamId || !slackUserId) {
      await replaceSlackInteraction(initialResponseUrl, "Beckett could not read the Slack workspace and user context.");
      return;
    }

    const claim = await claimPendingRequest({ requestId, teamId, slackUserId });
    console.info("Slack slash pending request claim complete", {
      requestId,
      intent,
      responseDetail,
      claimed: Boolean(claim.pending),
      failureMessage: claim.pending ? null : claim.message,
    });
    if (!claim.pending) {
      await replaceSlackInteraction(initialResponseUrl, claim.message || "Please run `/beckett` again.");
      return;
    }

    const pending = claim.pending;
    const responseUrl = initialResponseUrl || pending.response_url || "";
    const user = await lookupSlackConnectedUser(teamId, slackUserId);
    console.info("Slack slash button user lookup complete", {
      requestId,
      intent,
      responseDetail,
      connected: Boolean(user),
    });
    if (!user) {
      await replaceSlackInteraction(responseUrl, slackConnectText(origin));
      return;
    }

    if (!isAllowedSlackPlan(user)) {
      await replaceSlackInteraction(responseUrl, "Beckett Slack coaching is available for beta and pro users.");
      return;
    }

    const channelContext = await fetchSlackConversationContext({
      accessToken: user.accessToken,
      channelId: pending.slack_channel_id,
      channelName: pending.slack_channel_name,
    });
    const coachingContext = await buildSlackCoachingContext({
      user,
      prompt: pending.prompt,
      activeContext: channelContext,
      contextChannelId: pending.slack_channel_id,
      includeBroaderContext: shouldUseBroaderSlackContext(intent, pending.prompt),
      currentSlackUserId: slackUserId,
    });
    console.info("Slack slash channel context fetched", {
      requestId,
      intent,
      responseDetail,
      contextStatus: coachingContext.status,
      contextFailureReason: coachingContext.failureReason,
      contextMessageCount: coachingContext.messageCount,
      broaderSearchUsed: coachingContext.broaderSearchUsed,
    });
    const response = await runSlackCoaching({
      user,
      action: "slash_command",
      prompt: pending.prompt,
      sourceLabel: `/beckett:${intent}:${responseDetail}`,
      messageText: coachingContext.text,
      contextStatus: coachingContext.status,
      contextFailureReason: coachingContext.failureReason,
      contextMessageCount: coachingContext.messageCount,
      broaderSearchUsed: coachingContext.broaderSearchUsed,
      responseDetail,
      intent,
    });

    const responsePayload = buildAskedResponsePayload({
      prompt: pending.prompt,
      response,
      intent,
    });
    await replaceSlackInteraction(responseUrl, responsePayload.text, responsePayload.blocks);
    console.info("Slack slash final response posted", {
      requestId,
      intent,
      responseDetail,
    });
  } catch (error) {
    console.error("Slack slash button response failed", {
      requestId,
      intent,
      responseDetail,
      message: error instanceof Error ? error.message : String(error),
    });
    await replaceSlackInteraction(
      initialResponseUrl,
      `Beckett could not finish that request: ${handleSlackAiError(error)}`
    );
  }
}

export async function handleSlashButtonResponse({
  origin,
  payload,
  requestId,
  responseDetail,
  intent,
}: {
  origin: string;
  payload: SlackInteractionPayload;
  requestId: string;
  responseDetail: SlackResponseDetail;
  intent: SlackCoachingIntent;
}) {
  const responseUrl = payload.response_url || "";
  if (responseUrl) {
    await replaceSlackInteraction(responseUrl, `Beckett is preparing your ${detailLabel(responseDetail)}...`);
    console.info("Slack slash preparing state posted", {
      requestId,
      intent,
      responseDetail,
    });
  }

  await sendPendingSlashResponse({
    origin,
    payload,
    requestId,
    responseDetail,
    intent,
  });
}

export async function sendMessageShortcutResponse({
  origin,
  payload,
  messageText,
  intent,
}: {
  origin: string;
  payload: SlackInteractionPayload;
  messageText: string;
  intent: MessageShortcutIntent;
}) {
  const teamId = payload.team?.id || "";
  const slackUserId = payload.user?.id || "";
  const responseUrl = payload.response_url || "";

  try {
    const preparing = buildBeckettPayload({
      title: "Beckett",
      subtitle: "Message coaching",
      body: "Beckett is reading that message...",
      hideTitle: true,
    });
    await postSlackResponse(responseUrl, preparing.text, { blocks: preparing.blocks }).catch((error) => {
      console.error("Slack shortcut preparing response failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    });

    const user = await lookupSlackConnectedUser(teamId, slackUserId);
    if (!user) {
      const botAccessToken = await lookupSlackWorkspaceBotToken(teamId).catch((error) => {
        console.error("Slack workspace bot token lookup for guest shortcut failed", {
          teamPresent: Boolean(teamId),
          slackUserPresent: Boolean(slackUserId),
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
      if (!botAccessToken) {
        await postSlackResponse(responseUrl, slackConnectText(origin), { replaceOriginal: true });
        return;
      }

      const guestAuthorProfile = payload.message?.user
        ? await lookupSlackUserProfile(botAccessToken, payload.message.user).catch(() => null)
        : null;
      const guestAuthorLabel = guestAuthorProfile?.resolved
        ? guestAuthorProfile.name
        : payload.message?.username && !/^U[A-Z0-9]+$/i.test(payload.message.username)
          ? payload.message.username
          : "the message author";
      const guestPrompt = buildShortcutPrompt(payload, guestAuthorLabel, intent);
      const guestContext = await buildGuestSlackContextPacket({
        botAccessToken,
        channelId: payload.channel?.id,
        channelName: payload.channel?.name,
        selectedMessageText: messageText,
        selectedMessageTs: payload.message?.ts,
        threadTs: payload.message?.thread_ts,
        userRequest: guestPrompt,
        currentSlackUserId: slackUserId,
      });
      const response = await runSlackGuestCoaching({
        teamId,
        slackUserId,
        action: "message_shortcut",
        prompt: guestPrompt,
        messageText: guestContext.text || messageText,
        intent,
      });
      const agentDelivery = await postSlackAgentMessage({
        botAccessToken,
        slackUserId,
        title: slackHistoryTitle(intent, "selected message"),
        text: selectedMessageOpener(intent, guestAuthorLabel, messageText),
      });

      let agentReplyPosted = false;
      let agentChannelId: string | null = null;
      if (agentDelivery.ok && "channelId" in agentDelivery && "ts" in agentDelivery && agentDelivery.channelId && agentDelivery.ts) {
        agentChannelId = agentDelivery.channelId;
        await saveSlackGuestSelectedMessageState({
          teamId,
          slackUserId,
          state: {
            threadTs: agentDelivery.ts,
            intent,
            author: guestAuthorLabel,
            message: messageText,
            sourceChannelId: payload.channel?.id,
            sourceChannelName: payload.channel?.name,
            sourceMessageTs: payload.message?.ts,
            sourceThreadTs: payload.message?.thread_ts,
            context: guestContext.context?.text || undefined,
          },
        }).catch((error) => {
          console.error("Slack guest selected-message state save failed", {
            message: error instanceof Error ? error.message : String(error),
          });
        });
        await startSlackGuestSession({
          teamId,
          slackUserId,
          channelId: agentDelivery.channelId,
          threadTs: agentDelivery.ts,
          flowType: intent,
          source: {
            channelId: payload.channel?.id,
            channelName: payload.channel?.name,
            messageTs: payload.message?.ts,
            threadTs: payload.message?.thread_ts,
            author: guestAuthorLabel,
            message: messageText,
            context: guestContext.context?.text || undefined,
          },
          artifacts: { latestResponse: response },
          transcript: [
            { role: "user", content: guestPrompt },
            { role: "beckett", content: response },
          ],
        }).catch((error) => {
          console.error("Slack guest session start failed", {
            message: error instanceof Error ? error.message : String(error),
          });
        });
        const responsePayload = buildBeckettPayload({
          title: "Beckett",
          subtitle: "",
          body: response,
          hideTitle: true,
        });
        const reply = await slackApiPost(botAccessToken, "chat.postMessage", {
          channel: agentDelivery.channelId,
          thread_ts: agentDelivery.ts,
          ...responsePayload,
        });
        agentReplyPosted = Boolean(reply.ok);
        if (!agentReplyPosted) {
          console.error("Slack guest shortcut assistant reply failed", {
            teamPresent: Boolean(teamId),
            slackUserPresent: Boolean(slackUserId),
            error: reply.error || "agent_reply_failed",
          });
        }
      }

      if (agentReplyPosted) {
        if (agentChannelId) {
          scheduleSlackBackgroundTask(
            "Slack guest shortcut inactivity menu cancellation failed",
            cancelGuestInactivityStartCard({
              botAccessToken,
              channelId: agentChannelId,
            })
          );
        }
        const ack = buildBeckettPayload({
          title: "Beckett",
          subtitle: "Message coaching",
          body: "I moved this into our private Beckett conversation.",
        });
        await postSlackResponse(responseUrl, ack.text, {
          blocks: ack.blocks,
          replaceOriginal: true,
        });
        return;
      }

      const responsePayload = buildBeckettPayload({
        title: "Beckett",
        subtitle: "",
        body: [
          "I prepared this privately here because the Beckett coach panel was not available.",
          "",
          response,
        ].join("\n"),
        footer: "Guest mode is on for judging. Connecting Slack adds profile, contacts, history, and saved conversations.",
        hideTitle: true,
      });
      await postSlackResponse(responseUrl, responsePayload.text, {
        blocks: responsePayload.blocks,
        replaceOriginal: true,
      });
      return;
    }

    const authorRelationship = await resolveSlackAuthorRelationshipContext({
      user,
      teamId,
      slackAuthorUserId: payload.message?.user,
      interactionType: "slack_message_shortcut",
    });
    const authorLabel =
      authorRelationship?.contact?.name ||
      (authorRelationship?.slackProfile?.resolved ? authorRelationship.slackProfile.name : null) ||
      (payload.message?.username && !/^U[A-Z0-9]+$/i.test(payload.message.username) ? payload.message.username : null) ||
      "the message author";
    const prompt = buildShortcutPrompt(payload, authorLabel, intent);

    if (!isAllowedSlackPlan(user)) {
      await postSlackResponse(responseUrl, "Beckett Slack coaching is available for beta and pro users.", {
        replaceOriginal: true,
      });
      return;
    }

    const channelContext = await fetchSlackConversationContext({
      accessToken: user.accessToken,
      channelId: payload.channel?.id,
      channelName: payload.channel?.name,
      messageTs: payload.message?.ts,
      threadTs: payload.message?.thread_ts,
    });
    const coachingContext = await buildSlackCoachingContext({
      user,
      prompt,
      activeContext: channelContext,
      contextChannelId: payload.channel?.id,
      includeBroaderContext: shouldUseBroaderSlackContext(intent, prompt),
      relevantSlackUserIds: [payload.message?.user].filter(Boolean) as string[],
      currentSlackUserId: slackUserId,
    });
    const combinedContext = [
      "Selected Slack message:",
      messageText,
      coachingContext.text ? `\n${coachingContext.text}` : "",
    ].filter(Boolean).join("\n");
    const savedSourceContext = [
      "Shortcut source context saved for follow-up:",
      "",
      "Selected Slack message:",
      messageText,
      channelContext.text ? `\nSurrounding Slack context:\n${channelContext.text}` : "",
    ].filter(Boolean).join("\n");
    const response = await runSlackCoaching({
      user,
      action: "message_shortcut",
      prompt,
      sourceLabel: "slack_message_shortcut",
      messageText: combinedContext,
      contextStatus: coachingContext.status,
      contextFailureReason: coachingContext.failureReason,
      contextMessageCount: coachingContext.messageCount,
      broaderSearchUsed: coachingContext.broaderSearchUsed,
      relationshipContext: authorRelationship?.promptContext || null,
      intent,
      responseDetail: "quick",
    });

    const agentDelivery = await postSlackAgentMessage({
      botAccessToken: user.botAccessToken,
      slackUserId,
      title: slackHistoryTitle(intent, authorLabel || (payload.channel?.name ? `#${payload.channel.name}` : "this Slack conversation")),
      text: selectedMessageOpener(intent, authorLabel || "the message author", messageText),
    });

    if (agentDelivery.ok) {
      const agentChannelId = "channelId" in agentDelivery ? agentDelivery.channelId : null;
      const agentThreadTs = "ts" in agentDelivery ? agentDelivery.ts : null;
      if (agentChannelId && agentThreadTs && user.botAccessToken) {
        const coachingThread = await createSlackCoachingThread({
          user,
          teamId,
          slackUserId,
          flowType: intent,
          title: slackHistoryTitle(intent, authorLabel || (payload.channel?.name ? `#${payload.channel.name}` : "this Slack conversation")),
          promptSnippet: prompt,
          summary: summarizeSlackCoachingResponse(
            response,
            `${intent === "decode" ? "Decoded" : "Drafted from"} the selected Slack message; source context is saved for follow-up.`
          ),
          slackChannelId: agentChannelId,
          threadTs: agentThreadTs,
          sourceChannelId: payload.channel?.id,
          sourceChannelName: payload.channel?.name,
          status: "completed",
        }).catch((error) => {
          console.error("Slack shortcut history create failed", {
            message: error instanceof Error ? error.message : String(error),
          });
          return null;
        });
        if (coachingThread?.id) {
          await recordSlackCoachingBotMessage({
            threadId: coachingThread.id,
            userId: user.id,
            channelId: agentChannelId,
            messageTs: agentThreadTs,
            kind: "opener",
          }).catch(() => null);
          await appendSlackCoachingMessage({
            threadId: coachingThread.id,
            user,
            teamId,
            slackUserId,
            role: "user",
            content: prompt,
          }).catch(() => null);
          await appendSlackCoachingMessage({
            threadId: coachingThread.id,
            user,
            teamId,
            slackUserId,
            role: "user",
            content: savedSourceContext,
          }).catch(() => null);
        }

        const responsePayload = buildBeckettPayload({
          title: "Beckett",
          subtitle: "",
          body: response,
          hideTitle: true,
        });
        const postedResponse = await slackApiPost<{ ts?: string }>(user.botAccessToken, "chat.postMessage", {
          channel: agentChannelId,
          thread_ts: agentThreadTs,
          ...responsePayload,
        });
        if (postedResponse.ok && postedResponse.ts) {
          await recordSlackCoachingBotMessage({
            threadId: coachingThread?.id,
            userId: user.id,
            channelId: agentChannelId,
            messageTs: postedResponse.ts,
            kind: "reply",
          }).catch(() => null);
          await appendSlackCoachingMessage({
            threadId: coachingThread?.id,
            user,
            teamId,
            slackUserId,
            role: "beckett",
            content: response,
          }).catch(() => null);
        }

        const draftSession = intent === "respond"
          ? await createSlackDraftActionSession({
              user,
              teamId,
              slackUserId,
              agentChannelId,
              agentThreadTs,
              sourceChannelId: payload.channel?.id,
              sourceChannelName: payload.channel?.name,
              sourceThreadTs: payload.message?.thread_ts || payload.message?.ts,
              prompt,
              response,
            })
          : { actions: [] };

        if (draftSession.actions.length) {
          const actionPayload = buildBeckettPayload({
            title: "Beckett",
            subtitle: "Choose a draft",
            body: "Pick the version you want to review before sending.",
            hideTitle: true,
            actions: [
              ...draftSession.actions,
              ...buildSlackExplainMoreAction(coachingThread?.id),
              ...buildSlackThreadArchiveAction(coachingThread?.id),
            ],
          });
          const postedAction = await slackApiPost<{ ts?: string }>(user.botAccessToken, "chat.postMessage", {
            channel: agentChannelId,
            thread_ts: agentThreadTs,
            ...actionPayload,
          });
          if (postedAction.ok && postedAction.ts) {
            await recordSlackCoachingBotMessage({
              threadId: coachingThread?.id,
              userId: user.id,
              channelId: agentChannelId,
              messageTs: postedAction.ts,
              kind: "actions",
            }).catch(() => null);
          }
        }
        if (coachingThread?.id) {
          scheduleSlackBackgroundTask(
            "Slack inactivity start card failed",
            scheduleSlackInactivityStartCard({
              botAccessToken: user.botAccessToken,
              threadId: coachingThread.id,
              userId: user.id,
              channelId: agentChannelId,
            })
          );
        }
      }

      const ack = buildBeckettPayload({
        title: "Beckett",
        subtitle: "Message coaching",
        body: "I moved this into our private conversation.",
      });
      await postSlackResponse(responseUrl, ack.text, { blocks: ack.blocks, replaceOriginal: true });
      return;
    }

    const responsePayload = buildBeckettPayload({
      title: "Beckett",
      subtitle: "Message coaching",
      prompt,
      body: [
        "I prepared this privately here because the Beckett coach panel was not available.",
        response,
      ].filter(Boolean).join("\n\n"),
    });
    await postSlackResponse(responseUrl, responsePayload.text, { blocks: responsePayload.blocks, replaceOriginal: true });
  } catch (error) {
    await postSlackResponse(responseUrl, `Beckett could not finish that request: ${handleSlackAiError(error)}`, {
      replaceOriginal: true,
    });
  }
}
