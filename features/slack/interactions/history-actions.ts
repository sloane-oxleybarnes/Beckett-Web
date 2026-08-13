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


function quickPrompt(flowType: SlackHistoryFlowType) {
  switch (flowType) {
    case "respond":
      return "Help me respond to a Slack conversation.";
    case "decode":
      return "Help me decode a Slack conversation and separate visible facts from possible interpretation.";
    case "rewrite":
      return "Help me rewrite a Slack message.";
    case "prep":
      return "Help me prepare for a conversation.";
    case "practice":
      return "Help me practice a conversation.";
    default:
      return "Help me with this Slack conversation.";
  }
}

function selectedMessageInstructions(flowType: "decode" | "respond") {
  const shortcut = flowType === "respond" ? "Beckett - Respond" : "Beckett - Decode";
  const request = flowType === "respond"
    ? "Share the message you want to respond to:"
    : "Share the message you want to decode:";

  return [
    request,
    `- Use the message’s ⋯ menu and choose ‘${shortcut}’`,
    `- Type \`/beckett ${flowType}\` in that Slack conversation`,
    "- Paste the message or send its Slack link here",
  ].join("\n");
}

export async function cancelGuestInactivityStartCard({
  botAccessToken,
  channelId,
}: {
  botAccessToken: string;
  channelId: string;
}) {
  await cancelSlackInactivityStartCard({
    botAccessToken,
    channelId,
  });
}

export async function handleHistoryButtonResponse({
  payload,
  actionId,
  threadId,
  flowType,
}: {
  payload: SlackInteractionPayload;
  actionId: string;
  threadId?: string;
  flowType?: SlackHistoryFlowType;
}) {
  const teamId = payload.team?.id || "";
  const slackUserId = payload.user?.id || "";

  try {
    if (!teamId || !slackUserId) return;
    const user = await lookupSlackConnectedUser(teamId, slackUserId);
    if (!user?.botAccessToken || !isAllowedSlackPlan(user)) {
      const botAccessToken = await lookupSlackWorkspaceBotToken(teamId).catch((error) => {
        console.error("Slack workspace bot token lookup for guest history action failed", {
          teamPresent: Boolean(teamId),
          slackUserPresent: Boolean(slackUserId),
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
      if (
        botAccessToken &&
        actionId.startsWith(SLACK_HISTORY_QUICK_ACTION_ID) &&
        (flowType === "respond" ||
          flowType === "rewrite" ||
          flowType === "decode" ||
          flowType === "prep" ||
          flowType === "practice")
      ) {
        const channelId = payload.channel?.id;
        if (!channelId) return;

        if (flowType === "decode" || flowType === "respond") {
          const instructionPayload = buildBeckettPayload({
            title: "Beckett",
            subtitle: "",
            body: selectedMessageInstructions(flowType),
            hideTitle: true,
          });
          await slackApiPost(botAccessToken, "chat.postMessage", {
            channel: channelId,
            ...instructionPayload,
          });
          return;
        }

        const response = flowType === "prep"
          ? [
              "Let’s prep this conversation together.",
              "",
              "First, who are you talking to, and what is the conversation about?",
              "You can describe their role or tag them with @.",
            ].join("\n")
          : flowType === "practice"
            ? [
                "Let’s set up the practice.",
                "",
                "Who should I role-play, and what conversation are you practicing?",
              ].join("\n")
            : [
                "Let’s rewrite your message.",
                "",
                "Who is it going to, where will you send it, and what draft do you have so far?",
              ].join("\n");
        const payloadToPost = buildBeckettPayload({
          title: "Beckett",
          subtitle: "",
          body: response,
          footer: "Guest mode • Connect Beckett for personalized context.",
          hideTitle: true,
        });
        const openerText = flowType === "practice"
          ? "Let’s practice this conversation privately. Reply in this thread so the role-play stays together."
          : flowType === "rewrite"
            ? "Let’s rewrite this message privately. Reply in this thread so the draft and revisions stay together."
            : "Let’s prep this conversation privately. Reply in this thread so the setup, practice, and next steps stay together.";
        const opened = await postSlackAgentMessage({
          botAccessToken,
          slackUserId,
          title: slackHistoryTitle(flowType),
          text: openerText,
        });
        const openedTs = "ts" in opened ? opened.ts : null;
        if (opened.ok && opened.channelId && openedTs) {
          await startSlackGuestSession({
            teamId,
            slackUserId,
            channelId: opened.channelId,
            threadTs: openedTs,
            flowType,
            state: flowType === "prep" ? { step: "person" } : { step: "awaiting_input" },
            transcript: [{ role: "beckett", content: response }],
          }).catch((error) => {
            console.error("Slack guest quick-action session start failed", {
              message: error instanceof Error ? error.message : String(error),
            });
          });
          if (flowType === "prep") {
            await saveSlackGuestPrepState({
              teamId,
              slackUserId,
              state: { threadTs: openedTs, step: "person" },
            }).catch((error) => {
              console.error("Slack guest prep state initialization failed", {
                message: error instanceof Error ? error.message : String(error),
              });
            });
          }
          await slackApiPost(botAccessToken, "chat.postMessage", {
            channel: opened.channelId,
            thread_ts: openedTs,
            ...payloadToPost,
          });
          scheduleSlackBackgroundTask(
            "Slack guest quick-action inactivity menu cancellation failed",
            cancelSlackInactivityStartCard({ botAccessToken, channelId: opened.channelId })
          );
        } else {
          // Preserve a usable fallback if Slack's assistant-thread opener fails.
          await slackApiPost(botAccessToken, "chat.postMessage", {
            channel: channelId,
            ...payloadToPost,
          });
        }
      }
      return;
    }
    const thread = threadId ? await loadSlackCoachingThread({ threadId, userId: user.id }) : null;

    if (actionId === SLACK_HISTORY_ARCHIVE_ACTION_ID && threadId) {
      await archiveSlackCoachingThread({ threadId, userId: user.id });
      // Slack does not let third-party apps fully clear a user's DM history.
      // Archive means Beckett saves/closes the case and posts a fresh bottom entry point.
      if (thread?.slack_channel_id) {
        await setSlackAgentSuggestedPrompts({
          botAccessToken: user.botAccessToken,
          channelId: thread.slack_channel_id,
        }).catch(() => null);
        const startPayload = buildSlackStartCardPayload("archived");
        const postedStartCard = await slackApiPost<{ ts?: string }>(user.botAccessToken, "chat.postMessage", {
          channel: thread.slack_channel_id,
          ...startPayload,
        }).catch((error) => {
          console.error("Slack archive start card post failed", {
            threadId,
            message: error instanceof Error ? error.message : String(error),
          });
          return null;
        });
        if (postedStartCard?.ok && postedStartCard.ts) {
          await recordSlackCoachingBotMessage({
            threadId,
            userId: user.id,
            channelId: thread.slack_channel_id,
            messageTs: postedStartCard.ts,
            kind: "archive_start_card",
          }).catch(() => null);
        }
      }
      await publishSlackHome({
        botAccessToken: user.botAccessToken,
        slackUserId,
        userId: user.id,
        notice: "Archived to Beckett History. Start something new from Messages when you are ready.",
      });
      return;
    }

    if (actionId === SLACK_HISTORY_EXPLAIN_MORE_ACTION_ID && thread) {
      const snapshot = await fetchSlackThreadSnapshot({
        accessToken: user.botAccessToken || user.accessToken,
        channelId: thread.slack_channel_id,
        threadTs: thread.thread_ts,
        currentSlackUserId: slackUserId,
      });
      const messages = snapshot.status === "available"
        ? []
        : await loadSlackCoachingMessages({ threadId: thread.id, userId: user.id, limit: 10 }).catch(() => []);
      const transcript = snapshot.status === "available"
        ? formatSlackThreadSnapshot(snapshot, 3000)
        : messages
            .map((message) => `${message.role === "beckett" ? "Beckett" : "User"}: ${message.content}`)
            .join("\n")
            .slice(0, 3000);
      if (!transcript) {
        if (thread.slack_channel_id && thread.thread_ts) {
          await slackApiPost(user.botAccessToken, "chat.postMessage", {
            channel: thread.slack_channel_id,
            thread_ts: thread.thread_ts,
            ...buildBeckettPayload({
              title: "Beckett",
              body: "I couldn’t reload this thread’s earlier messages, so I can’t safely explain them further. Please try again or reconnect Beckett.",
              hideTitle: true,
            }),
          });
        }
        return;
      }
      const response = await runSlackCoaching({
        user,
        action: "agent_message",
        prompt: [
          `The user clicked Explain more for this Beckett case: ${thread.title}.`,
          thread.summary ? `Current summary: ${thread.summary}` : "",
          transcript ? `Recent conversation:\n${transcript}` : "",
          "",
          "Give a slightly deeper explanation while staying Slack-native and practical. Do not add new draft options unless they materially help.",
        ].filter(Boolean).join("\n"),
        sourceLabel: `${thread.title}:explain_more`,
        messageText: transcript || thread.summary || thread.prompt_snippet || "",
        contextStatus: "available",
        contextMessageCount: snapshot.status === "available" ? snapshot.turns.length : messages.length,
        broaderSearchUsed: false,
        intent: thread.flow_type === "respond" ||
          thread.flow_type === "decode" ||
          thread.flow_type === "rewrite" ||
          thread.flow_type === "relationship"
          ? thread.flow_type
          : "general",
        responseDetail: "longer",
      });
      await appendSlackCoachingMessage({
        threadId: thread.id,
        user,
        teamId,
        slackUserId,
        role: "beckett",
        content: response,
      }).catch(() => null);
      const payloadToPost = buildBeckettPayload({
        title: "Beckett",
        subtitle: "",
        body: response,
        hideTitle: true,
      });
      if (thread.slack_channel_id && thread.thread_ts) {
        const postedExplain = await slackApiPost<{ ts?: string }>(user.botAccessToken, "chat.postMessage", {
          channel: thread.slack_channel_id,
          thread_ts: thread.thread_ts,
          ...payloadToPost,
        });
        if (postedExplain.ok && postedExplain.ts) {
          await recordSlackCoachingBotMessage({
            threadId: thread.id,
            userId: user.id,
            channelId: thread.slack_channel_id,
            messageTs: postedExplain.ts,
            kind: "explain_more",
          }).catch(() => null);
          scheduleSlackBackgroundTask(
            "Slack inactivity start card failed",
            scheduleSlackInactivityStartCard({
              botAccessToken: user.botAccessToken,
              threadId: thread.id,
              userId: user.id,
              channelId: thread.slack_channel_id,
            })
          );
        }
      }
      return;
    }

    if (actionId === SLACK_HISTORY_CONTINUE_ACTION_ID && thread) {
      const snapshot = await fetchSlackThreadSnapshot({
        accessToken: user.botAccessToken || user.accessToken,
        channelId: thread.slack_channel_id,
        threadTs: thread.thread_ts,
        currentSlackUserId: slackUserId,
      });
      const messages = snapshot.status === "available"
        ? []
        : await loadSlackCoachingMessages({ threadId: thread.id, userId: user.id, limit: 10 }).catch(() => []);
      const liveTranscript = snapshot.status === "available"
        ? formatSlackThreadSnapshot(snapshot, 1800)
        : null;
      const payloadToPost = buildSlackHistoryContinuePayload(thread, messages, liveTranscript);
      if (thread.slack_channel_id && thread.thread_ts) {
        const postedContinue = await slackApiPost<{ ts?: string }>(user.botAccessToken, "chat.postMessage", {
          channel: thread.slack_channel_id,
          thread_ts: thread.thread_ts,
          ...payloadToPost,
        });
        if (postedContinue.ok && postedContinue.ts) {
          await recordSlackCoachingBotMessage({
            threadId: thread.id,
            userId: user.id,
            channelId: thread.slack_channel_id,
            messageTs: postedContinue.ts,
            kind: "continue",
          }).catch(() => null);
          scheduleSlackBackgroundTask(
            "Slack inactivity start card failed",
            scheduleSlackInactivityStartCard({
              botAccessToken: user.botAccessToken,
              threadId: thread.id,
              userId: user.id,
              channelId: thread.slack_channel_id,
            })
          );
        }
      } else {
        await postSlackAgentMessage({
          botAccessToken: user.botAccessToken,
          slackUserId,
          title: `Continue: ${thread.title}`,
          text: payloadToPost.text,
        });
      }
      await publishSlackHome({
        botAccessToken: user.botAccessToken,
        slackUserId,
        userId: user.id,
        notice: "I reopened that conversation in Messages. Slack keeps the Home tab here, so switch to Messages to keep going.",
      }).catch(() => null);
      return;
    }

    if (
      actionId.startsWith(SLACK_HISTORY_QUICK_ACTION_ID) &&
      (flowType === "respond" ||
        flowType === "rewrite" ||
        flowType === "decode" ||
        flowType === "prep" ||
        flowType === "practice")
    ) {
      const practiceSnapshot = flowType === "practice" && thread
        ? await fetchSlackThreadSnapshot({
            accessToken: user.botAccessToken || user.accessToken,
            channelId: thread.slack_channel_id,
            threadTs: thread.thread_ts,
            currentSlackUserId: slackUserId,
          })
        : null;
      const practiceMessages = flowType === "practice" && thread && practiceSnapshot?.status !== "available"
        ? await loadSlackCoachingMessages({ threadId: thread.id, userId: user.id, limit: 12 }).catch(() => [])
        : [];
      const practiceTurns = practiceSnapshot?.status === "available" ? practiceSnapshot.turns : [];
      const practiceConcern = [...practiceTurns].reverse().find((turn) =>
        turn.role === "user" && /\b(worried|concern|afraid|think i(?:'m| am)|lazy|capable|pushback)\b/i.test(turn.text)
      )?.text || [...practiceMessages].reverse().find((message) =>
        message.role === "user" && /\b(worried|concern|afraid|think i(?:'m| am)|lazy|capable|pushback)\b/i.test(message.content)
      )?.content;
      if (flowType === "decode" || flowType === "respond") {
        const channelId = payload.channel?.id;
        if (channelId) {
          const instructionPayload = buildBeckettPayload({
            title: "Beckett",
            subtitle: "",
            body: selectedMessageInstructions(flowType),
            hideTitle: true,
          });
          await slackApiPost(user.botAccessToken, "chat.postMessage", {
            channel: channelId,
            ...instructionPayload,
          });
        }
        return;
      }

      const started = await startGuidedSlackFlow({
        user,
        teamId,
        slackUserId,
        intent: flowType,
        // Continue is the only action that may reopen an existing case.
        // Quick actions always begin with a clean guided session.
        prompt: flowType === "practice" && thread
          ? [
              "Prepared conversation context. Start the whole role-play immediately.",
              thread.summary || thread.prompt_snippet || "Use the completed Prep context.",
              `Concern and realistic pushback: ${practiceConcern || "Use realistic resistance that tests the user's goal without becoming hostile."}`,
              ...(practiceTurns.length
                ? [formatSlackThreadSnapshot(practiceSnapshot!, 3000)]
                : practiceMessages.map((message) => `${message.role === "beckett" ? "Beckett" : "User"}: ${message.content}`)),
            ].join("\n")
          : quickPrompt(flowType),
      });
      await publishSlackHome({
        botAccessToken: user.botAccessToken,
        slackUserId,
        userId: user.id,
        notice: started.ok
          ? "I started that conversation in Messages. Slack keeps the Home tab here, so switch to Messages to keep going."
          : "I had trouble starting that private conversation. Try opening Messages and sending me a note directly.",
      }).catch(() => null);
    }
  } catch (error) {
    console.error("Slack history button action failed", {
      actionId,
      threadId,
      flowType,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
