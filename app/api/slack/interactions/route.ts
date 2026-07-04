import { NextRequest, NextResponse } from "next/server";
import {
  buildAskedResponsePayload,
  buildBeckettPayload,
  buildSlackCoachingContext,
  fetchSlackConversationContext,
  handleSlackAiError,
  isAllowedSlackPlan,
  lookupSlackConnectedUser,
  postSlackAgentMessage,
  postSlackResponse,
  runSlackCoaching,
  scheduleSlackBackgroundTask,
  slackConnectText,
  slackContextUserNote,
  SlackBlock,
  SlackCoachingIntent,
  SLACK_SLASH_LONGER_ACTION_ID,
  SLACK_SLASH_QUICK_ACTION_ID,
  SlackResponseDetail,
  verifySlackRequest,
} from "@/lib/slack-app";
import { supabaseAdmin } from "@/lib/server-admin";

export const runtime = "nodejs";

type SlackInteractionPayload = {
  type?: string;
  callback_id?: string;
  response_url?: string;
  team?: { id?: string; domain?: string };
  user?: { id?: string; username?: string };
  actions?: Array<{ action_id?: string; value?: string }>;
  view?: {
    callback_id?: string;
    private_metadata?: string;
    state?: {
      values?: Record<
        string,
        Record<
          string,
          {
            type?: string;
            value?: string;
            selected_user?: string;
            selected_conversation?: string;
            selected_option?: { value?: string; text?: { text?: string } };
          }
        >
      >;
    };
  };
  message?: {
    text?: string;
    user?: string;
    username?: string;
    ts?: string;
    thread_ts?: string;
    attachments?: Array<{ text?: string; fallback?: string }>;
  };
  channel?: { id?: string; name?: string };
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

function parseInteractionPayload(rawBody: string): SlackInteractionPayload | null {
  const params = new URLSearchParams(rawBody);
  const payload = params.get("payload");
  if (!payload) return null;
  try {
    return JSON.parse(payload) as SlackInteractionPayload;
  } catch {
    return null;
  }
}

function buildShortcutPrompt(payload: SlackInteractionPayload) {
  const channel = payload.channel?.name ? `#${payload.channel.name}` : "this Slack conversation";
  const author = payload.message?.username || payload.message?.user || "the other person";
  return [
    `Help me understand this message from ${author} in ${channel}.`,
    "What might be happening underneath it, what should I pay attention to, and what could I say next?",
  ].join(" ");
}

function extractMessageText(payload: SlackInteractionPayload) {
  const mainText = payload.message?.text?.trim();
  if (mainText) return mainText;

  const attachmentText = payload.message?.attachments
    ?.map((attachment) => attachment.text || attachment.fallback || "")
    .join("\n")
    .trim();

  return attachmentText || "";
}

function parseSlashActionValue(value: string): { requestId: string; intent: SlackCoachingIntent } | null {
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

function getSlashDetailAction(payload: SlackInteractionPayload) {
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

function detailLabel(responseDetail: SlackResponseDetail) {
  return responseDetail === "longer" ? "longer explanation" : "quick answer";
}

async function replaceSlackInteraction(responseUrl: string, text: string, blocks?: SlackBlock[]) {
  await postSlackResponse(responseUrl, text, {
    replaceOriginal: true,
    blocks,
  });
}

async function loadPendingRequest(requestId: string) {
  const { data, error } = await supabaseAdmin
    .from("slack_pending_requests")
    .select(
      "id, user_id, slack_team_id, slack_user_id, slack_channel_id, slack_channel_name, prompt, response_url, expires_at, completed_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  return data as SlackPendingRequest | null;
}

async function claimPendingRequest({
  requestId,
  teamId,
  slackUserId,
}: {
  requestId: string;
  teamId: string;
  slackUserId: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
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

async function sendPendingSlashResponse({
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

    const contextNote = slackContextUserNote(coachingContext);
    const responsePayload = buildAskedResponsePayload({
      prompt: pending.prompt,
      response,
      intent,
      footer: contextNote || (coachingContext.broaderSearchUsed ? "Used relevant Slack history for context." : undefined),
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

async function handleSlashButtonResponse({
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

async function sendMessageShortcutResponse({
  origin,
  payload,
  messageText,
}: {
  origin: string;
  payload: SlackInteractionPayload;
  messageText: string;
}) {
  const teamId = payload.team?.id || "";
  const slackUserId = payload.user?.id || "";
  const responseUrl = payload.response_url || "";

  try {
    const user = await lookupSlackConnectedUser(teamId, slackUserId);
    if (!user) {
      await postSlackResponse(responseUrl, slackConnectText(origin));
      return;
    }

    if (!isAllowedSlackPlan(user)) {
      await postSlackResponse(responseUrl, "Beckett Slack coaching is available for beta and pro users.");
      return;
    }

    const channelContext = await fetchSlackConversationContext({
      accessToken: user.accessToken,
      channelId: payload.channel?.id,
      channelName: payload.channel?.name,
      messageTs: payload.message?.ts,
      threadTs: payload.message?.thread_ts,
    });
    const prompt = buildShortcutPrompt(payload);
    const coachingContext = await buildSlackCoachingContext({
      user,
      prompt,
      activeContext: channelContext,
      contextChannelId: payload.channel?.id,
    });
    const combinedContext = [
      "Selected Slack message:",
      messageText,
      coachingContext.text ? `\n${coachingContext.text}` : "",
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
      intent: "respond",
    });

    const contextNote = slackContextUserNote(coachingContext);
    const agentDelivery = await postSlackAgentMessage({
      botAccessToken: user.botAccessToken,
      slackUserId,
      title: "Message coaching",
      text: [
        contextNote || (coachingContext.broaderSearchUsed ? "Used relevant Slack history for context." : ""),
        response,
      ].filter(Boolean).join("\n\n"),
    });

    if (agentDelivery.ok) {
      const ack = buildBeckettPayload({
        title: "Beckett",
        subtitle: "Message coaching",
        body: "I moved this into your private Beckett conversation.",
      });
      await postSlackResponse(responseUrl, ack.text, { blocks: ack.blocks });
      return;
    }

    const responsePayload = buildBeckettPayload({
      title: "Beckett",
      subtitle: "Message coaching",
      prompt,
      body: [
        "I prepared this privately here because the Beckett coach panel was not available.",
        contextNote || "",
        response,
      ].filter(Boolean).join("\n\n"),
    });
    await postSlackResponse(responseUrl, responsePayload.text, { blocks: responsePayload.blocks });
  } catch (error) {
    await postSlackResponse(responseUrl, `Beckett could not finish that request: ${handleSlackAiError(error)}`);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const verification = verifySlackRequest(req, rawBody);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.message }, { status: verification.status });
  }

  const payload = parseInteractionPayload(rawBody);
  if (!payload) return NextResponse.json({ error: "Invalid Slack payload." }, { status: 400 });

  if (payload.type === "block_actions") {
    const detailAction = getSlashDetailAction(payload);
    if (!detailAction) return NextResponse.json({ ok: true });

    console.info("Slack slash button clicked", {
      requestId: detailAction.requestId,
      intent: detailAction.intent,
      responseDetail: detailAction.responseDetail,
      hasResponseUrl: Boolean(payload.response_url),
      teamPresent: Boolean(payload.team?.id),
      userPresent: Boolean(payload.user?.id),
    });

    scheduleSlackBackgroundTask(
      "Slack slash choice response failed",
      handleSlashButtonResponse({
        origin: req.nextUrl.origin,
        payload,
        requestId: detailAction.requestId,
        responseDetail: detailAction.responseDetail,
        intent: detailAction.intent,
      })
    );

    return NextResponse.json({ ok: true });
  }

  if (payload.type !== "message_action" || payload.callback_id !== "beckett_message_context") {
    return NextResponse.json({ ok: true });
  }

  const teamId = payload.team?.id;
  const slackUserId = payload.user?.id;
  const responseUrl = payload.response_url || "";
  const messageText = extractMessageText(payload);

  if (!teamId || !slackUserId) {
    await postSlackResponse(responseUrl, "Beckett could not read the Slack workspace and user context.");
    return NextResponse.json({ ok: true });
  }

  if (!messageText) {
    await postSlackResponse(responseUrl, "Beckett could not read message text from that Slack shortcut.");
    return NextResponse.json({ ok: true });
  }

  await postSlackResponse(responseUrl, "Beckett is reading this Slack context privately...");
  scheduleSlackBackgroundTask(
    "Slack message shortcut response failed",
    sendMessageShortcutResponse({
      origin: req.nextUrl.origin,
      payload,
      messageText,
    })
  );
  return NextResponse.json({ ok: true });
}
