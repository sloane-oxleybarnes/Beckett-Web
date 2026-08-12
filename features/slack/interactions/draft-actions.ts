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
import { supabaseAdmin } from "@/lib/server-admin";
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
import { buildDraftActionValue, buildDraftConfirmationPayload, draftDestinationLabel, loadDraftSession, replaceSlackInteraction } from './core-actions';


export async function handleDraftButtonResponse({
  origin,
  payload,
  actionId,
  sessionId,
  optionId,
  draftText,
}: {
  origin: string;
  payload: SlackInteractionPayload;
  actionId: string;
  sessionId: string;
  optionId: SlackDraftOption["id"];
  draftText?: string;
}) {
  const responseUrl = payload.response_url || "";
  const teamId = payload.team?.id || "";
  const slackUserId = payload.user?.id || "";

  try {
    if (!teamId || !slackUserId) {
      await replaceSlackInteraction(responseUrl, "Beckett could not read the Slack workspace and user context.");
      return;
    }

    const session = await loadDraftSession({ sessionId, teamId, slackUserId });
    const liveOptions = extractSlackDraftOptions(payload.message?.text || "");
    const recoveredText = draftText || liveOptions.find((item) => item.id === optionId)?.text;
    const option = recoveredText
      ? {
          id: optionId,
          label: optionId === "direct" ? "Direct but kind" : optionId === "warm" ? "Warm and collaborative" : "Concise",
          text: recoveredText,
        } satisfies SlackDraftOption
      : session?.answers?.draft_options?.find((item) => item.id === optionId);
    if (!session || !option) {
      await replaceSlackInteraction(responseUrl, "That draft is no longer available. Ask Beckett to draft a new response.");
      return;
    }

    if (actionId === SLACK_DRAFT_CANCEL_ACTION_ID) {
      await replaceSlackInteraction(responseUrl, "Canceled. Nothing was posted.");
      return;
    }

    if (!session.answers.source_channel_id) {
      await replaceSlackInteraction(
        responseUrl,
        [
          "I do not have the original Slack destination for this draft, so I will not offer a send button.",
          "",
          option.text,
        ].join("\n")
      );
      return;
    }

    const destination = draftDestinationLabel(session.answers);
    if (actionId === SLACK_DRAFT_USE_ACTION_ID) {
      const confirmation = buildDraftConfirmationPayload({ sessionId, option, destination });
      await replaceSlackInteraction(responseUrl, confirmation.text, confirmation.blocks);
      return;
    }

    const user = await lookupSlackConnectedUser(teamId, slackUserId);
    if (!user?.botAccessToken) {
      await replaceSlackInteraction(responseUrl, slackConnectText(origin, "Beckett could not send that draft because Slack needs to be reconnected."));
      return;
    }

    const sent = await slackApiPost<{ ts?: string }>(user.botAccessToken, "chat.postMessage", {
      channel: session.answers.source_channel_id,
      thread_ts: session.answers.source_thread_ts,
      text: option.text,
    });

    if (!sent.ok) {
      await replaceSlackInteraction(
        responseUrl,
        `Beckett could not post that draft to ${destination}: ${sent.error || "Slack did not accept the message."}`
      );
      return;
    }

    await replaceSlackInteraction(responseUrl, `Sent to ${destination}.`);
  } catch (error) {
    console.error("Slack draft button action failed", {
      sessionId,
      optionId,
      actionId,
      message: error instanceof Error ? error.message : String(error),
    });
    await replaceSlackInteraction(responseUrl, "Beckett could not finish that draft action. Please try again.");
  }
}
