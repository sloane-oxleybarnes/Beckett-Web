import { NextRequest, NextResponse } from "next/server";
import {
  postSlackResponse,
  scheduleSlackBackgroundTask,
  verifySlackRequest,
} from "@/lib/slack-app";
import {
  extractMessageText,
  messageShortcutIntent,
  parseInteractionPayload,
} from "@/features/slack/interaction-contracts";
import { getDraftAction, getGuestPrepPracticeAction, getHistoryAction, getSlashDetailAction, handleGuestPrepPracticeAction, handleSlashButtonResponse, sendMessageShortcutResponse } from './core-actions';
import { handleDraftButtonResponse } from './draft-actions';
import { handleHistoryButtonResponse } from './history-actions';


export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const verification = verifySlackRequest(req, rawBody);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.message }, { status: verification.status });
  }

  const payload = parseInteractionPayload(rawBody);
  if (!payload) return NextResponse.json({ error: "Invalid Slack payload." }, { status: 400 });

  if (payload.type === "block_actions") {
    const guestPrepPracticeAction = getGuestPrepPracticeAction(payload);
    if (guestPrepPracticeAction) {
      // URL buttons open the signed redirect themselves. Ack the accompanying
      // Slack action without also creating a second Practice thread.
      if (guestPrepPracticeAction.direct) return NextResponse.json({ ok: true });
      scheduleSlackBackgroundTask(
        "Slack guest prep practice handoff failed",
        handleGuestPrepPracticeAction({
          payload,
          prepThreadTs: guestPrepPracticeAction.prepThreadTs,
        })
      );
      return NextResponse.json({ ok: true });
    }

    const historyAction = getHistoryAction(payload);
    if (historyAction) {
      scheduleSlackBackgroundTask(
        "Slack history button response failed",
        handleHistoryButtonResponse({
          payload,
          actionId: historyAction.actionId,
          threadId: historyAction.threadId,
          flowType: historyAction.flowType,
        })
      );
      return NextResponse.json({ ok: true });
    }

    const draftAction = getDraftAction(payload);
    if (draftAction) {
      scheduleSlackBackgroundTask(
        "Slack draft button response failed",
        handleDraftButtonResponse({
          origin: req.nextUrl.origin,
          payload,
          actionId: draftAction.actionId,
          sessionId: draftAction.sessionId,
          optionId: draftAction.optionId,
          draftText: draftAction.draftText,
        })
      );

      return NextResponse.json({ ok: true });
    }

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

  const shortcutIntent = messageShortcutIntent(payload.callback_id);
  if (
    payload.type !== "message_action" ||
    !["beckett_message_context", "beckett_message_decode", "beckett_message_respond"].includes(payload.callback_id || "")
  ) {
    return NextResponse.json({ ok: true });
  }

  const teamId = payload.team?.id;
  const slackUserId = payload.user?.id;
  const responseUrl = payload.response_url || "";
  const messageText = extractMessageText(payload);

  if (!teamId || !slackUserId) {
    if (responseUrl) {
      scheduleSlackBackgroundTask(
        "Slack shortcut missing user response failed",
        postSlackResponse(responseUrl, "Beckett could not read the Slack workspace and user context.")
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (!messageText) {
    if (responseUrl) {
      scheduleSlackBackgroundTask(
        "Slack shortcut missing text response failed",
        postSlackResponse(responseUrl, "Beckett could not read message text from that Slack shortcut.")
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (!responseUrl) {
    return NextResponse.json({ ok: true });
  }

  scheduleSlackBackgroundTask(
    "Slack message shortcut response failed",
    sendMessageShortcutResponse({
      origin: req.nextUrl.origin,
      payload,
      messageText,
      intent: shortcutIntent,
    })
  );
  return NextResponse.json({ ok: true });
}
