import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { logError } from "@/lib/structured-logger";
import { getPublicSiteUrl } from "@/lib/deployment-env";
import { slackRepository } from "@/lib/repositories/slack-repository";
import type { SlackThreadTurn } from "@/lib/slack-thread-rehydration";
import { settleSlackCreditForPayload } from "@/lib/slack-credits";

export const MAX_SLACK_TEXT_LENGTH = 2800;
export const MAX_SLACK_CONTEXT_MESSAGES = 25;
export const MAX_SLACK_CONTEXT_LENGTH = 7000;
export const MAX_SLACK_BROAD_CONTEXT_LENGTH = 2600;
export const MAX_SLACK_BROAD_CONTEXT_RESULTS = 12;
export const MAX_SLACK_ASKED_PROMPT_LENGTH = 650;
export const MAX_QUICK_SLACK_ANSWER_LENGTH = 650;
export const MAX_LONGER_SLACK_ANSWER_LENGTH = 2000;
export const SLACK_SLASH_QUICK_ACTION_ID = "beckett_slash_quick";
export const SLACK_SLASH_LONGER_ACTION_ID = "beckett_slash_longer";
export const REQUIRED_SLACK_USER_SCOPES: string[] = [];

export type SlackResponseDetail = "quick" | "longer";
export type SlackCoachingIntent =
  | "general"
  | "rewrite"
  | "decode"
  | "draft"
  | "relationship"
  | "prep"
  | "tone"
  | "followup"
  | "respond"
  | "clarity"
  | "boundary"
  | "practice";
export type SlackBlock = Record<string, unknown>;
export type SlackContextStatus = "available" | "unavailable";
export type SlackContextFailureReason =
  | "missing_token"
  | "missing_channel"
  | "no_messages"
  | "missing_scope"
  | "feature_not_enabled"
  | "not_in_channel"
  | "channel_not_found"
  | "slack_api_error";
export type SlackConversationContext = {
  text: string | null;
  status: SlackContextStatus;
  failureReason: SlackContextFailureReason | null;
  messageCount: number;
  broaderSearchUsed?: boolean;
  retrievalMethod?: string;
  relevantUserIds?: string[];
};

export function isCompactSlackIntent(intent: SlackCoachingIntent) {
  return intent === "decode" || intent === "respond" || intent === "rewrite" || intent === "relationship";
}

export function shouldUseBroaderSlackContext(intent: SlackCoachingIntent, prompt: string) {
  void intent;
  void prompt;
  return false;
}

export type SlackMessageOptions = {
  blocks?: SlackBlock[];
  replaceOriginal?: boolean;
  responseType?: "ephemeral" | "in_channel";
};

export type SlackActionElement = Record<string, unknown>;

export type BeckettBlockOptions = {
  title?: string;
  subtitle?: string;
  prompt?: string;
  body?: string;
  footer?: string;
  actions?: SlackActionElement[];
  hideTitle?: boolean;
};

export type SlackConnectedUser = {
  id: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  accessToken: string | null;
  botAccessToken: string | null;
  teamName: string | null;
  grantedUserScopes: string[];
  missingUserScopes: string[];
  communicationPreferences: string[];
  coachingTone: string | null;
  strengths: string[];
  workplaceTriggers: string[];
  neurodivergentContext: string[];
  neurodivergentContextOther: string | null;
  toolkitItems: { course_id?: string | null; category?: string | null; label?: string | null; content?: string | null }[];
  slackTeamId: string;
  slackUserId: string;
};

export { verifySlackRequest } from "@/lib/slack-verification";

export type VercelRequestContext = {
  get?: () =>
    | {
        waitUntil?: (task: Promise<unknown>) => void;
      }
    | undefined;
};

export type SlackHistoryMessage = {
  type?: string;
  user?: string;
  username?: string;
  bot_id?: string;
  text?: string;
  subtype?: string;
  ts?: string;
  thread_ts?: string;
  reactions?: Array<{ name?: string; users?: string[]; count?: number }>;
};

export type { SlackThreadTurn } from "@/lib/slack-thread-rehydration";

export type SlackThreadSnapshot = {
  status: SlackContextStatus;
  failureReason: SlackContextFailureReason | null;
  turns: SlackThreadTurn[];
};

export type SlackLatestMessageContext = {
  targetText: string;
  targetTs: string | null;
  context: SlackConversationContext;
};

export type SlackUserInfo = {
  ok?: boolean;
  error?: string;
  user?: {
    id?: string;
    name?: string;
    real_name?: string;
    profile?: {
      display_name?: string;
      real_name?: string;
    };
  };
};

export type SlackSearchContextResponse = {
  ok?: boolean;
  error?: string;
  results?: unknown[] | { messages?: unknown[]; files?: unknown[]; channels?: unknown[] };
  matches?: unknown[];
  messages?: unknown[] | { matches?: unknown[] };
  items?: unknown[];
};

export type SlackLegacySearchResponse = {
  ok?: boolean;
  error?: string;
  messages?: { matches?: unknown[] };
};

export type SlackSearchInfoResponse = {
  ok?: boolean;
  error?: string;
  is_ai_search_enabled?: boolean;
};

export const slackUserNameCache = new Map<string, string>();

export function slackCreditRequestId(parts: Array<string | null | undefined>) {
  const day = new Date().toISOString().slice(0, 10);
  const secret = process.env.SLACK_SIGNING_SECRET || "beckett-slack-credit-id";
  const digest = createHmac("sha256", secret).update([day, ...parts.map((part) => part || "")].join("\u001f")).digest("hex");
  return `slack_${digest.slice(0, 48)}`;
}

export function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function splitSlackScopes(value: unknown) {
  if (Array.isArray(value)) return value.filter((scope): scope is string => typeof scope === "string");
  return String(value || "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function slackUnavailable(reason: SlackContextFailureReason, retrievalMethod?: string): SlackConversationContext {
  return { text: null, status: "unavailable", failureReason: reason, messageCount: 0, retrievalMethod };
}

export function slackContextFailureReasonForError(error?: string | null): SlackContextFailureReason {
  if (error === "missing_scope") return "missing_scope";
  if (error === "feature_not_enabled") return "feature_not_enabled";
  if (error === "not_in_channel") return "not_in_channel";
  if (error === "channel_not_found") return "channel_not_found";
  return "slack_api_error";
}

export function normalizeSlackUserId(value: string | null | undefined) {
  const match = String(value || "").match(/\bU[A-Z0-9]{6,}\b/);
  return match?.[0] || null;
}

export function uniqueSlackUserIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(normalizeSlackUserId).filter(Boolean) as string[]));
}

export function slackUserIdsFromMessages(messages: Array<SlackHistoryMessage | undefined>) {
  return uniqueSlackUserIds(messages.map((message) => message?.user));
}

export async function noteSlackContextValidation(userId: string, failureReason: SlackContextFailureReason | null) {
  const { data } = await slackRepository
    .from("user_integrations")
    .select("metadata")
    .eq("user_id", userId)
    .eq("provider", "slack")
    .maybeSingle();
  const metadata = metadataRecord(data?.metadata);
  await slackRepository
    .from("user_integrations")
    .update({
      metadata: {
        ...metadata,
        last_validated_at: new Date().toISOString(),
        last_failure_reason: failureReason,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "slack");
}

export function buildSlackMessagePayload(text: string, options: SlackMessageOptions = {}) {
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

export function splitSlackSectionText(text: string, maxLength = 2850) {
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

export function removeStandaloneSlackUncertaintySections(text: string) {
  const uncertaintyHeading =
    /^(?:~\s*)?(?:what(?:['’]s| is| isn['’]t)? not knowable|what not to over-?read|what (?:i|beckett) can(?:not|'t|’t) know|unknowns?)(?:\s*~)?\s*:?\s*$/i;
  const knownHeading =
    /^(?:~\s*)?(?:possible read|next move|draft options|relationship read|what i['’]m basing this on|what is visible|visible facts|rewritten message|why this works|prep notes|talking points|opening sentence|likely pushback|follow-up draft|conversation goal|practice prompt|goal|say this first|if they push back|watch for|practice next|what works|try this version|direct but kind|warm and collaborative|concise)(?:\s*~)?\s*:?\s*$/i;
  const lines = text.split("\n");
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (uncertaintyHeading.test(trimmed)) {
      skipping = true;
      continue;
    }
    if (skipping && knownHeading.test(trimmed)) {
      skipping = false;
    }
    if (!skipping) kept.push(line);
  }

  return kept.join("\n");
}

export function canonicalSlackHeading(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "possible read") return "Possible read";
  if (normalized === "next move") return "Next move";
  if (normalized === "draft options") return "Draft options";
  if (normalized === "relationship read") return "Relationship read";
  if (normalized === "what i'm basing this on" || normalized === "what i’m basing this on") return "What I’m basing this on";
  if (normalized === "goal") return "Goal";
  if (normalized === "say this first") return "Say this first";
  if (normalized === "if they push back") return "If they push back";
  if (normalized === "watch for") return "Watch for";
  if (normalized === "practice next") return "Practice next";
  if (normalized === "what works") return "What works";
  if (normalized === "try this version") return "Try this version";
  if (normalized === "why it works") return "Why it works";
  return null;
}

export function canonicalDraftLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "direct but kind") return "Direct but kind";
  if (normalized === "warm and collaborative") return "Warm and collaborative";
  if (normalized === "concise") return "Concise";
  return null;
}

export function formatSlackCoachingDisplayText(text: string) {
  const lines = text.split("\n");
  const formatted: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const heading = canonicalSlackHeading(trimmed.replace(/^~\s*|\s*~$/g, "").replace(/:$/, ""));
    if (heading) {
      formatted.push(`~ ${heading} ~`);
      continue;
    }

    const draftMatch = trimmed.match(/^[-•]?\s*(Direct but kind|Warm and collaborative|Concise)\s*:?\s*(.*)$/i);
    if (draftMatch) {
      const label = canonicalDraftLabel(draftMatch[1]) || draftMatch[1];
      const inlineText = draftMatch[2]?.trim();
      if (inlineText) {
        formatted.push(`- ${label}: ${inlineText}`);
        continue;
      }

      let nextIndex = index + 1;
      while (nextIndex < lines.length && !lines[nextIndex].trim()) nextIndex += 1;
      const nextLine = lines[nextIndex]?.trim();
      const nextIsHeading = nextLine
        ? Boolean(canonicalSlackHeading(nextLine.replace(/^~\s*|\s*~$/g, "").replace(/:$/, "")))
        : false;
      const nextIsDraftLabel = nextLine
        ? /^[-•]?\s*(Direct but kind|Warm and collaborative|Concise)\s*:?\s*/i.test(nextLine)
        : false;

      if (nextLine && !nextIsHeading && !nextIsDraftLabel) {
        formatted.push(`- ${label}: ${nextLine}`);
        index = nextIndex;
        continue;
      }

      formatted.push(`- ${label}:`);
      continue;
    }

    formatted.push(line);
  }

  return formatted.join("\n");
}

export function cleanSlackDisplayText(text: string) {
  const plainText = removeStandaloneSlackUncertaintySections(text)
    .replace(/\bU[A-Z0-9]{8,}\b/g, "the Slack user")
    .replace(/\*\*([^*\n][^*]*?)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\n][^*]*?)\*(?=\s|$|[.,!?;:])/g, "$1$2")
    .replace(/\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return formatSlackCoachingDisplayText(plainText);
}

export function formatSlackMrkdwnForBlocks(text: string) {
  return text
    .replace(
      /^(Reply in this thread so I can keep this message, (?:read|drafts), and follow-ups saved together\.)$/gim,
      "*$1*"
    )
    .replace(/^(Possible read|Next move|Draft options|Relationship read|What I['’]m basing this on)\s*:?\s*$/gim, "*$1*")
    .replace(/^[-•]?\s*(Direct but kind|Warm and collaborative|Concise)\s*:\s*/gim, "- $1: ")
    .replace(/^(What(?:['’]s| is| isn['’]t) not knowable|What not to over-?read)\s*:?\s*$/gim, "");
}

export function buildBeckettBlocks({
  title = "Beckett",
  subtitle = "Communication coach",
  prompt,
  body,
  footer,
  actions,
  hideTitle = false,
}: BeckettBlockOptions): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  if (!hideTitle) {
    blocks.push({
      type: "header",
      text: { type: "plain_text", text: title.slice(0, 150) },
    });
  }

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
        text: { type: "mrkdwn", text: formatSlackMrkdwnForBlocks(chunk) },
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

export function buildBeckettPayload({
  title,
  subtitle,
  prompt,
  body,
  footer,
  actions,
  hideTitle,
}: BeckettBlockOptions) {
  const cleanedBody = cleanSlackDisplayText(body || "");
  const fallback = [hideTitle ? null : title || "Beckett", subtitle, prompt, cleanedBody, footer]
    .filter(Boolean)
    .join("\n\n");
  return {
    text: truncateSlackText(cleanSlackDisplayText(fallback || "Beckett is ready.")),
    blocks: buildBeckettBlocks({ title, subtitle, prompt, body: cleanedBody, footer, actions, hideTitle }),
  };
}

export function slackMessageResponse(text: string, options: SlackMessageOptions & { status?: number } = {}) {
  return NextResponse.json(buildSlackMessagePayload(text, options), { status: options.status || 200 });
}

export function slackTextResponse(text: string, status = 200) {
  return slackMessageResponse(text, { status });
}

export function slackErrorResponse(message: string, status = 200) {
  return slackTextResponse(`Beckett could not finish that request: ${message}`, status);
}

export function slackConnectText(origin: string, detail?: string) {
  const settingsUrl = `${getPublicSiteUrl(origin)}/dashboard/settings`;
  return [
    detail || "I could not match this Slack account to a Beckett beta profile yet.",
    "",
    `Connect Slack from Beckett Settings, then try again: <${settingsUrl}|Open Beckett Settings>`,
  ].join("\n");
}

export function slackConnectResponse(origin: string, detail?: string) {
  return slackTextResponse(slackConnectText(origin, detail));
}

export async function postSlackResponse(responseUrl: string, text: string, options: SlackMessageOptions = {}) {
  if (!responseUrl) return;
  const payload = buildSlackMessagePayload(text, options);
  const response = await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await settleSlackCreditForPayload(payload, response.ok).catch((error) => {
    logError("slack.credit_settlement_failed", error, { provider: "slack", operation: "credit_settlement" });
  });
}

export function scheduleSlackBackgroundTask(label: string, task: Promise<void>) {
  const handledTask = task.catch((error) => {
    logError("slack.background_task_failed", error, {
      provider: "slack",
      operation: label.replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 60),
    });
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

export function escapeSlackMrkdwn(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatAskedPrompt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  const truncated =
    normalized.length <= MAX_SLACK_ASKED_PROMPT_LENGTH
      ? normalized
      : `${normalized.slice(0, MAX_SLACK_ASKED_PROMPT_LENGTH - 12).trim()}...`;
  return escapeSlackMrkdwn(truncated);
}

export function slackAskedLabel(intent: SlackCoachingIntent = "general") {
  switch (intent) {
    case "rewrite":
      return "You asked Beckett to rewrite:";
    case "decode":
      return "You asked Beckett to decode:";
    case "relationship":
      return "You asked Beckett about:";
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

export function formatAskedResponse(prompt: string, response: string, intent: SlackCoachingIntent = "general") {
  const header = [slackAskedLabel(intent), `>${formatAskedPrompt(prompt)}`, ""].join("\n");
  const availableAnswerLength = Math.max(800, MAX_SLACK_TEXT_LENGTH - header.length - 2);
  return cleanSlackDisplayText(`${header}\n${fitSlackAnswer(response, availableAnswerLength)}`);
}

export function buildAskedResponsePayload({
  prompt,
  response,
  intent = "general",
  footer,
}: {
  prompt: string;
  response: string;
  intent?: SlackCoachingIntent;
  footer?: string;
}) {
  const label = slackAskedLabel(intent).replace(/:$/, "");
  return buildBeckettPayload({
    title: "Beckett",
    subtitle: label,
    prompt,
    body: fitSlackAnswer(response, MAX_LONGER_SLACK_ANSWER_LENGTH),
    footer,
  });
}

export function slackIntentInstruction(intent: SlackCoachingIntent) {
  switch (intent) {
    case "rewrite":
      return "Slack intent hint: The user likely wants editing or rewriting. Bias toward a rewritten version, but if their latest message asks a different question, answer that instead.";
    case "decode":
      return [
        "Slack intent hint: The user likely wants tone/subtext analysis. Bias toward a concise read, but if they ask for drafting, feedback assessment, prep, or something else, switch to that.",
        "For decode answers, use exactly these headings when they fit: Possible read and Next move.",
        "Keep decode answers short: 1-2 sentences under Possible read and 1-3 bullets or questions under Next move.",
        "Do not use separate headings like What's visible, What might be underneath, or What to pay attention to unless the user explicitly asks for a deeper breakdown.",
        "If a phrase is ambiguous, Next move should include concrete clarifying questions the user could ask.",
      ].join(" ");
    case "relationship":
      return "Slack intent hint: The user likely wants a broad relationship, history, vibe, pattern, or dynamic read. Do not force single-message decode language unless the user asks about one specific message.";
    case "draft":
      return "Slack intent hint: The user likely wants ready-to-use wording. Provide draft language when useful, but ask one focused question if the target or goal is genuinely unclear.";
    case "prep":
      return "Slack intent hint: The user likely wants difficult-conversation prep. Continue prep if that fits their latest message; switch if they correct the goal or ask for analysis/drafting instead.";
    case "tone":
      return "Slack intent hint: The user likely wants to know how wording may land. Identify tone risks and offer cleaner wording if useful.";
    case "followup":
      return "Slack intent hint: The user likely wants follow-up wording. Keep it specific, low-pressure, and clear about the next step.";
    case "respond":
      return "Slack intent hint: The user likely wants help responding. Bias toward a short read and Slack-ready draft options, but if their latest message asks for analysis, feedback assessment, or prep, answer that instead.";
    case "clarity":
      return "Slack intent hint: The user likely wants a clarity question. Identify missing information and draft a specific answerable question when useful.";
    case "boundary":
      return "Slack intent hint: The user likely wants boundary wording. Keep it firm, kind, specific, and realistic for Slack.";
    case "practice":
      return "Slack intent hint: The user likely wants practice. Start or continue role-play only if that matches their latest message.";
    default:
      return "Slack intent hint: General Beckett coaching. Answer the user's specific request directly.";
  }
}

export function truncateSlackText(text: string) {
  if (text.length <= MAX_SLACK_TEXT_LENGTH) return text
  return `${text.slice(0, MAX_SLACK_TEXT_LENGTH - 40).trim()}\n\n_Trimmed for Slack._`
}

export function fitSlackAnswer(text: string, maxLength: number) {
  const cleaned = text.replace(/\n\n_Trimmed for Slack\._$/i, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length <= maxLength) return cleaned
  const hardLimit = Math.max(200, maxLength - 3)
  const slice = cleaned.slice(0, hardLimit)
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf('\n'))
  const cutoff = sentenceEnd > hardLimit * 0.55 ? sentenceEnd + 1 : hardLimit
  return `${cleaned.slice(0, cutoff).trim()}...`
}
