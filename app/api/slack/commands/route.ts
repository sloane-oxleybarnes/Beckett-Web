import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_SLACK_TEXT_LENGTH = 2800;
const SLACK_SLASH_QUICK_ACTION_ID = "beckett_slash_quick";
const SLACK_SLASH_LONGER_ACTION_ID = "beckett_slash_longer";

type SlackCoachingIntent =
  | "general"
  | "rewrite"
  | "decode"
  | "draft"
  | "prep"
  | "tone"
  | "followup"
  | "respond"
  | "clarity"
  | "boundary"
  | "practice";
type SlackBlock = Record<string, unknown>;
type SlackMessageOptions = {
  blocks?: SlackBlock[];
  replaceOriginal?: boolean;
  responseType?: "ephemeral" | "in_channel";
};
type SlackVerificationResult =
  | { ok: true }
  | { ok: false; status: number; message: string };
type VercelRequestContext = {
  get?: () =>
    | {
        waitUntil?: (task: Promise<unknown>) => void;
      }
    | undefined;
};

type SlashCommandPayload = {
  team_id?: string;
  user_id?: string;
  channel_id?: string;
  channel_name?: string;
  text?: string;
  command?: string;
  response_url?: string;
  trigger_id?: string;
  ssl_check?: string;
};

type ParsedSlackCommand = {
  intent: SlackCoachingIntent;
  prompt: string;
  missingText?: string;
};

type SlackPrepModalMetadata = {
  intent: "prep";
  prompt: string;
  responseUrl: string;
  teamId: string;
  userId: string;
  channelId?: string;
  channelName?: string;
};

type SlackViewBlock = Record<string, unknown>;
type SlackActionElement = Record<string, unknown>;
type BeckettBlockOptions = {
  title?: string;
  subtitle?: string;
  prompt?: string;
  body?: string;
  footer?: string;
  actions?: SlackActionElement[];
};

function safeCompare(value: string, expected: string) {
  const valueBuffer = Buffer.from(value, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

function verifySlackRequest(req: NextRequest, rawBody: string): SlackVerificationResult {
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!signingSecret) {
    return { ok: false, status: 500, message: "Slack signing secret is not configured." };
  }

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");
  const timestampNumber = Number(timestamp);

  if (!timestamp || !signature || !Number.isFinite(timestampNumber)) {
    return { ok: false, status: 401, message: "Missing Slack signature." };
  }

  const ageInSeconds = Math.abs(Date.now() / 1000 - timestampNumber);
  if (ageInSeconds > 60 * 5) {
    return { ok: false, status: 401, message: "Slack request is too old." };
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const expectedSignature = `v0=${createHmac("sha256", signingSecret).update(base).digest("hex")}`;

  if (!safeCompare(signature, expectedSignature)) {
    return { ok: false, status: 401, message: "Invalid Slack signature." };
  }

  return { ok: true };
}

function truncateSlackText(text: string, maxLength = MAX_SLACK_TEXT_LENGTH) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 24).trim()}\n\n_Response shortened._`;
}

function buildSlackMessagePayload(text: string, options: SlackMessageOptions = {}) {
  return {
    response_type: options.responseType || "ephemeral",
    replace_original: options.replaceOriginal || false,
    text: truncateSlackText(text),
    blocks:
      options.blocks ||
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: truncateSlackText(text),
          },
        },
      ],
  };
}

function splitSlackSectionText(text: string, maxLength = 2850) {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maxLength) {
    const slice = remaining.slice(0, maxLength);
    const breakAt = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf("\n"), slice.lastIndexOf(". "));
    const cutoff = breakAt > maxLength * 0.5 ? breakAt + 1 : maxLength;
    chunks.push(remaining.slice(0, cutoff).trim());
    remaining = remaining.slice(cutoff).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function cleanSlackDisplayText(text: string) {
  return text
    .replace(/\*\*([^*\n][^*]*?)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\n][^*]*?)\*(?=\s|$|[.,!?;:])/g, "$1$2")
    .replace(/\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildBeckettBlocks({
  title = "Beckett",
  subtitle = "Communication coach",
  prompt,
  body,
  footer,
  actions,
}: BeckettBlockOptions): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: title.slice(0, 150) },
    },
  ];

  if (subtitle) {
    blocks.push({
      type: "context",
      elements: [{ type: "plain_text", text: subtitle.slice(0, 300) }],
    });
  }

  if (prompt) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `_${escapeSlackMrkdwn(cleanSlackDisplayText(prompt)).slice(0, 900)}_`,
      },
    });
  }

  if (body) {
    blocks.push({ type: "divider" });
    for (const chunk of splitSlackSectionText(cleanSlackDisplayText(body))) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: chunk },
      });
    }
  }

  if (actions?.length) {
    blocks.push({ type: "actions", elements: actions });
  }

  if (footer) {
    blocks.push({
      type: "context",
      elements: [{ type: "plain_text", text: cleanSlackDisplayText(footer).slice(0, 300) }],
    });
  }

  return blocks.slice(0, 48);
}

function buildBeckettPayload({ title, subtitle, prompt, body, footer, actions }: BeckettBlockOptions) {
  const cleanedBody = cleanSlackDisplayText(body || "");
  const fallback = [title || "Beckett", subtitle, prompt, cleanedBody, footer].filter(Boolean).join("\n\n");
  return {
    text: truncateSlackText(cleanSlackDisplayText(fallback || "Beckett is ready.")),
    blocks: buildBeckettBlocks({ title, subtitle, prompt, body: cleanedBody, footer, actions }),
  };
}

function slackMessageResponse(text: string, options: SlackMessageOptions & { status?: number } = {}) {
  return NextResponse.json(buildSlackMessagePayload(text, options), { status: options.status || 200 });
}

function slackTextResponse(text: string, status = 200) {
  return slackMessageResponse(text, { status });
}

function slackErrorResponse(message: string, status = 200) {
  return slackTextResponse(`Beckett could not finish that request: ${message}`, status);
}

async function postSlackResponse(responseUrl: string, text: string, options: SlackMessageOptions = {}) {
  if (!responseUrl) return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSlackMessagePayload(text, options)),
  });
}

function scheduleSlackBackgroundTask(label: string, task: Promise<void>) {
  const handledTask = task.catch((error) => {
    console.error(label, error);
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

function escapeSlackMrkdwn(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slackAskedLabel(intent: SlackCoachingIntent = "general") {
  switch (intent) {
    case "rewrite":
      return "You asked Beckett to rewrite:";
    case "decode":
      return "You asked Beckett to decode:";
    case "draft":
      return "You asked Beckett to draft:";
    case "prep":
      return "You asked Beckett to help you prep:";
    case "tone":
      return "You asked Beckett to check tone:";
    case "followup":
      return "You asked Beckett to follow up:";
    case "respond":
      return "You asked Beckett to help you respond:";
    case "clarity":
      return "You asked Beckett to help you ask for clarity:";
    case "boundary":
      return "You asked Beckett to help with a boundary:";
    case "practice":
      return "You asked Beckett to help you practice:";
    default:
      return "You asked:";
  }
}

function slackConnectText(origin: string) {
  return [
    "I could not match this Slack account to a Beckett beta profile yet.",
    "",
    `Connect Slack from Beckett Settings, then try again: <${origin}/dashboard/settings|Open Beckett Settings>`,
  ].join("\n");
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function lookupSlackConnectedUser(
  supabaseAdmin: typeof import("@/lib/server-admin")["supabaseAdmin"],
  teamId: string,
  slackUserId: string
) {
  const { data: integration, error } = await supabaseAdmin
    .from("user_integrations")
    .select("user_id, metadata")
    .eq("provider", "slack")
    .eq("external_team_id", teamId)
    .eq("external_user_id", slackUserId)
    .maybeSingle();

  if (error) throw error;
  if (!integration?.user_id) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, plan")
    .eq("id", integration.user_id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return null;

  const metadata = metadataRecord(integration.metadata);
  return {
    id: profile.id as string,
    plan: (profile.plan as string | null) || "free",
    botAccessToken: typeof metadata.access_token === "string" ? metadata.access_token : null,
  };
}

function isAllowedSlackPlan(user: { plan: string | null }) {
  return user.plan === "beta" || user.plan === "pro";
}

const slashSubcommands: Record<
  string,
  { intent: Exclude<SlackCoachingIntent, "general">; missingText: string }
> = {
  respond: {
    intent: "respond",
    missingText: "Add what you need help responding to after `/beckett respond`.",
  },
  rewrite: {
    intent: "rewrite",
    missingText: 'Add the draft message after `/beckett rewrite`, like `/beckett rewrite "Any update on this?"`.',
  },
  decode: {
    intent: "decode",
    missingText: 'Add the message you want Beckett to decode, like `/beckett decode "Sure, sounds fine."`.',
  },
  draft: {
    intent: "draft",
    missingText: "Add what you need to say after `/beckett draft`, like `/beckett draft ask my manager for clearer priorities this week`.",
  },
  prep: {
    intent: "prep",
    missingText: "Add the conversation you want to prepare for after `/beckett prep`.",
  },
  practice: {
    intent: "practice",
    missingText: "Add the conversation you want to practice after `/beckett practice`.",
  },
  clarity: {
    intent: "clarity",
    missingText: "Add what feels unclear after `/beckett clarity`.",
  },
  boundary: {
    intent: "boundary",
    missingText: "Add the boundary you need help setting after `/beckett boundary`.",
  },
  tone: {
    intent: "tone",
    missingText: 'Add the wording you want Beckett to check, like `/beckett tone "I need this by Friday."`.',
  },
  followup: {
    intent: "followup",
    missingText: "Add the follow-up you need after `/beckett followup`.",
  },
  "follow-up": {
    intent: "followup",
    missingText: "Add the follow-up you need after `/beckett follow-up`.",
  },
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
    trigger_id: params.get("trigger_id") || undefined,
    ssl_check: params.get("ssl_check") || undefined,
  };
}

function parseBeckettText(rawText: string): ParsedSlackCommand {
  const text = rawText.trim();
  const match = text.match(/^([a-z][a-z-]*):?\s*([\s\S]*)$/i);
  const command = match?.[1]?.toLowerCase();
  const definition = command ? slashSubcommands[command] : null;

  if (!definition) return { intent: "general", prompt: text };

  const prompt = (match?.[2] || "").trim();
  return {
    intent: definition.intent,
    prompt,
    missingText: prompt ? undefined : definition.missingText,
  };
}

function buildButtonValue(requestId: string, intent: SlackCoachingIntent) {
  return JSON.stringify({ requestId, intent });
}

function helpPayload(command = "/beckett") {
  return buildBeckettPayload({
    title: "Beckett",
    subtitle: "Communication coach",
    body: [
      "Use Beckett when a Slack message feels unclear, a reply needs careful wording, or you want to prepare for a workplace conversation.",
      "",
      "Try these:",
      `${command} rewrite "Any update on this?"`,
      `${command} decode "Sure, sounds fine."`,
      `${command} respond help me answer this without sounding defensive`,
      `${command} draft ask my manager for clearer priorities this week`,
      `${command} prep I need to tell a teammate their handoffs are too vague`,
      `${command} boundary I cannot take on another project this week`,
      `${command} clarity I do not know what "clean this up" means`,
      `${command} practice my 1:1 with my manager about workload`,
      `${command} tone "I need this by Friday."`,
      `${command} followup remind Avery about the readout`,
      "",
      "For a specific Slack message, use the message shortcut: Ask Beckett about this message.",
    ].join("\n"),
  });
}

function buildChoiceBlocks(prompt: string, requestId: string, intent: SlackCoachingIntent): SlackBlock[] {
  return buildBeckettBlocks({
    title: "Beckett",
    subtitle: slackAskedLabel(intent).replace(/:$/, ""),
    prompt,
    body: "How much help would you like?",
    actions: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Quick answer",
        },
        style: "primary",
        action_id: SLACK_SLASH_QUICK_ACTION_ID,
        value: buildButtonValue(requestId, intent),
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Longer explanation",
        },
        action_id: SLACK_SLASH_LONGER_ACTION_ID,
        value: buildButtonValue(requestId, intent),
      },
    ],
  });
}

function textInputBlock({
  blockId,
  actionId,
  label,
  placeholder,
  initialValue,
  multiline = false,
}: {
  blockId: string;
  actionId: string;
  label: string;
  placeholder: string;
  initialValue?: string;
  multiline?: boolean;
}): SlackViewBlock {
  return {
    type: "input",
    block_id: blockId,
    label: { type: "plain_text", text: label },
    element: {
      type: "plain_text_input",
      action_id: actionId,
      multiline,
      placeholder: { type: "plain_text", text: placeholder },
      ...(initialValue ? { initial_value: initialValue.slice(0, multiline ? 2900 : 140) } : {}),
    },
  };
}

function buildPrepModalView(prompt: string, metadata: SlackPrepModalMetadata) {
  return {
    type: "modal",
    callback_id: "beckett_prep_modal",
    title: { type: "plain_text", text: "Prep with Beckett" },
    submit: { type: "plain_text", text: "Start prep" },
    close: { type: "plain_text", text: "Cancel" },
    private_metadata: JSON.stringify(metadata).slice(0, 3000),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Beckett will use this context to help you prepare. This stays private to you.",
        },
      },
      textInputBlock({
        blockId: "talking_to",
        actionId: "value",
        label: "Who are you talking to?",
        placeholder: "My manager, Priya",
      }),
      textInputBlock({
        blockId: "conversation",
        actionId: "value",
        label: "What conversation do you need to have?",
        placeholder: "I need to ask about a promotion.",
        initialValue: prompt,
        multiline: true,
      }),
      textInputBlock({
        blockId: "outcome",
        actionId: "value",
        label: "What outcome do you want?",
        placeholder: "I want to understand what it would take to move up.",
        multiline: true,
      }),
      textInputBlock({
        blockId: "evidence",
        actionId: "value",
        label: "What evidence or context should Beckett know?",
        placeholder: "Projects, wins, feedback, metrics, timing, or relationship context.",
        multiline: true,
      }),
      textInputBlock({
        blockId: "pushback",
        actionId: "value",
        label: "What are you worried they may push back on?",
        placeholder: "Budget, timing, experience level, unclear expectations...",
        multiline: true,
      }),
    ],
  };
}

async function openSlackModal(botAccessToken: string, triggerId: string, view: Record<string, unknown>) {
  const res = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trigger_id: triggerId, view }),
  });
  return res.json().catch(() => ({})) as Promise<{ ok?: boolean; error?: string }>;
}

async function openPrepModal({
  origin,
  payload,
  parsed,
}: {
  origin: string;
  payload: SlashCommandPayload;
  parsed: ParsedSlackCommand;
}) {
  const responseUrl = payload.response_url || "";
  const { supabaseAdmin } = await import("@/lib/server-admin");

  if (!payload.team_id || !payload.user_id) return slackErrorResponse("Slack did not include the workspace and user context.");
  if (!payload.trigger_id) return slackTextResponse("Beckett could not open the prep form because Slack did not send a modal trigger.");

  const user = await lookupSlackConnectedUser(supabaseAdmin, payload.team_id, payload.user_id);
  if (!user) return slackTextResponse(slackConnectText(origin));
  if (!isAllowedSlackPlan(user)) return slackTextResponse("Beckett Slack coaching is available for beta and pro users.");
  if (!user.botAccessToken) {
    return slackTextResponse("Beckett could not open the prep form because the Slack bot token is missing. Reinstall the Slack app, then reconnect Slack in Beckett Settings.");
  }

  const modalMetadata: SlackPrepModalMetadata = {
    intent: "prep",
    prompt: parsed.prompt,
    responseUrl,
    teamId: payload.team_id,
    userId: payload.user_id,
    channelId: payload.channel_id,
    channelName: payload.channel_name,
  };
  const view = buildPrepModalView(parsed.prompt, modalMetadata);
  const opened = await openSlackModal(user.botAccessToken, payload.trigger_id, view);

  if (!opened.ok) {
    console.error("Slack prep modal open failed", {
      error: opened.error,
      teamPresent: Boolean(payload.team_id),
      userPresent: Boolean(payload.user_id),
      promptLength: parsed.prompt.length,
    });
    return slackTextResponse("Beckett could not open the prep form. I can still prep privately here if you run `/beckett prep` again.");
  }

  return slackTextResponse("Opening Beckett’s prep form...");
}

async function sendSlashChoiceCard({
  origin,
  payload,
  parsed,
}: {
  origin: string;
  payload: SlashCommandPayload;
  parsed: ParsedSlackCommand;
}) {
  const responseUrl = payload.response_url || "";
  const logContext = {
    teamPresent: Boolean(payload.team_id),
    userPresent: Boolean(payload.user_id),
    channelPresent: Boolean(payload.channel_id),
    intent: parsed.intent,
    promptLength: parsed.prompt.length,
  };

  try {
    console.info("Slack command setup started", logContext);
    const { supabaseAdmin } = await import("@/lib/server-admin");

    if (!payload.team_id || !payload.user_id) {
      await postSlackResponse(responseUrl, "Beckett could not read the Slack workspace and user context.", {
        replaceOriginal: true,
      });
      return;
    }

    const user = await lookupSlackConnectedUser(supabaseAdmin, payload.team_id, payload.user_id);
    console.info("Slack command user lookup complete", {
      ...logContext,
      connected: Boolean(user),
    });

    if (!user) {
      await postSlackResponse(responseUrl, slackConnectText(origin), { replaceOriginal: true });
      return;
    }

    if (!isAllowedSlackPlan(user)) {
      await postSlackResponse(responseUrl, "Beckett Slack coaching is available for beta and pro users.", {
        replaceOriginal: true,
      });
      return;
    }

    const requestId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("slack_pending_requests").insert({
      id: requestId,
      user_id: user.id,
      slack_team_id: payload.team_id,
      slack_user_id: payload.user_id,
      slack_channel_id: payload.channel_id || null,
      slack_channel_name: payload.channel_name || null,
      prompt: parsed.prompt,
      response_url: responseUrl,
      expires_at: expiresAt,
    });

    if (error) {
      console.error("Slack command pending insert failed", {
        ...logContext,
        code: error.code,
        message: error.message,
      });
      await postSlackResponse(responseUrl, "Beckett could not save this Slack request. Please try `/beckett` again.", {
        replaceOriginal: true,
      });
      return;
    }

    console.info("Slack command pending request inserted", {
      ...logContext,
      requestId,
    });

    await postSlackResponse(
      responseUrl,
      "Beckett can help with this Slack request. Choose the level of support you want.",
      {
        replaceOriginal: true,
        blocks: buildChoiceBlocks(parsed.prompt, requestId, parsed.intent),
      }
    );
    console.info("Slack command choice card posted", {
      ...logContext,
      requestId,
    });
  } catch (error) {
    console.error("Slack command setup failed", {
      ...logContext,
      message: error instanceof Error ? error.message : String(error),
    });
    await postSlackResponse(responseUrl, "Beckett could not open that request. Please try `/beckett` again.", {
      replaceOriginal: true,
    });
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

  if (!text) {
    const help = helpPayload(payload.command);
    return slackMessageResponse(help.text, { blocks: help.blocks });
  }

  const parsed = parseBeckettText(text);
  if (parsed.missingText) return slackTextResponse(parsed.missingText);

  if (!payload.response_url) {
    return slackErrorResponse("Slack did not include a response URL for this command.");
  }

  console.info("Slack command received", {
    teamPresent: Boolean(payload.team_id),
    userPresent: Boolean(payload.user_id),
    channelPresent: Boolean(payload.channel_id),
    intent: parsed.intent,
    promptLength: parsed.prompt.length,
  });

  if (parsed.intent === "prep") {
    return openPrepModal({
      origin: req.nextUrl.origin,
      payload,
      parsed,
    });
  }

  scheduleSlackBackgroundTask(
    "Slack command setup background task failed",
    sendSlashChoiceCard({
      origin: req.nextUrl.origin,
      payload,
      parsed,
    })
  );

  return slackTextResponse("Beckett is opening your request...");
}
