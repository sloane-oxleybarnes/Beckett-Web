import { NextRequest, NextResponse } from "next/server";
import {
  fetchSlackConversationContext,
  handleSlackAiError,
  isAllowedSlackPlan,
  lookupSlackConnectedUser,
  postSlackResponse,
  runSlackCoaching,
  slackConnectText,
  slackErrorResponse,
  slackTextResponse,
  verifySlackRequest,
} from "@/lib/slack-app";

export const runtime = "nodejs";

type SlashCommandPayload = {
  team_id?: string;
  user_id?: string;
  channel_id?: string;
  channel_name?: string;
  text?: string;
  command?: string;
  response_url?: string;
  ssl_check?: string;
};

type VercelRequestContext = {
  get?: () =>
    | {
        waitUntil?: (task: Promise<unknown>) => void;
      }
    | undefined;
};

function parseSlashCommand(rawBody: string): SlashCommandPayload {
  const params = new URLSearchParams(rawBody);
  return {
    team_id: params.get("team_id") || undefined,
    user_id: params.get("user_id") || undefined,
    channel_id: params.get("channel_id") || undefined,
    channel_name: params.get("channel_name") || undefined,
    text: params.get("text") || "",
    command: params.get("command") || undefined,
    response_url: params.get("response_url") || undefined,
    ssl_check: params.get("ssl_check") || undefined,
  };
}

function helpText(command = "/beckett") {
  return [
    "*Beckett is ready in Slack.*",
    "",
    `Try \`${command} is this too direct? "I need this by Friday."\``,
    `Try \`${command} help me rewrite: "Any update on this?"\``,
    "",
    "For help with a specific Slack message, use the message shortcut: *Ask Beckett about this message*.",
  ].join("\n");
}

function scheduleBackgroundTask(task: Promise<void>) {
  const handledTask = task.catch((error) => {
    console.error("Slack slash command response failed", error);
  });
  const requestContext = (globalThis as { [key: symbol]: VercelRequestContext | undefined })[
    Symbol.for("@vercel/request-context")
  ];
  const context = requestContext?.get?.();
  if (context?.waitUntil) {
    context.waitUntil(handledTask);
  } else {
    void handledTask;
  }
}

async function sendSlashCommandResponse({
  origin,
  payload,
  text,
}: {
  origin: string;
  payload: SlashCommandPayload;
  text: string;
}) {
  const responseUrl = payload.response_url || "";
  try {
    if (!payload.team_id || !payload.user_id) {
      await postSlackResponse(responseUrl, "Slack did not include the workspace and user context.");
      return;
    }

    const user = await lookupSlackConnectedUser(payload.team_id, payload.user_id);
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
      channelId: payload.channel_id,
      channelName: payload.channel_name,
    });
    const response = await runSlackCoaching({
      user,
      action: "slash_command",
      prompt: text,
      sourceLabel: payload.command || "/beckett",
      messageText: channelContext,
    });

    await postSlackResponse(responseUrl, response);
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

  const payload = parseSlashCommand(rawBody);
  if (payload.ssl_check === "1") return NextResponse.json({ ok: true });

  const text = payload.text?.trim() || "";
  if (!payload.team_id || !payload.user_id) {
    return slackErrorResponse("Slack did not include the workspace and user context.");
  }

  if (!text) return slackTextResponse(helpText(payload.command));

  if (!payload.response_url) {
    return slackErrorResponse("Slack did not include a response URL for this command.");
  }

  scheduleBackgroundTask(
    sendSlashCommandResponse({
      origin: req.nextUrl.origin,
      payload,
      text,
    })
  );

  return slackTextResponse("Got it - Beckett is thinking and will reply here in a moment.");
}
