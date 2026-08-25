export const TEAMS_ACTION_COMMANDS = {
  beckett_decode_selected: "decode",
  beckett_draft_response: "draft",
} as const;

export type TeamsActionIntent = (typeof TEAMS_ACTION_COMMANDS)[keyof typeof TEAMS_ACTION_COMMANDS];

export type TeamsMessageActionActivity = {
  type?: string;
  name?: string;
  id?: string;
  channelId?: string;
  from?: { id?: string; aadObjectId?: string };
  conversation?: { conversationType?: string; tenantId?: string };
  channelData?: { tenant?: { id?: string } };
  value?: {
    commandId?: string;
    commandContext?: string;
    messagePayload?: {
      body?: { contentType?: string; content?: string; textContent?: string };
    };
  };
};

export type ParsedTeamsMessageAction = {
  activityId: string;
  aadObjectId: string;
  tenantId: string | null;
  conversationType: string | null;
  intent: TeamsActionIntent;
  messageText: string;
};

export class TeamsMessageActionError extends Error {
  code:
    | "unsupported_activity"
    | "unsupported_command"
    | "selected_message_missing"
    | "teams_identity_missing";

  constructor(
    code:
      | "unsupported_activity"
      | "unsupported_command"
      | "selected_message_missing"
      | "teams_identity_missing",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const point = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

export function normalizeTeamsSelectedMessage(body?: {
  contentType?: string;
  content?: string;
  textContent?: string;
}) {
  const preferred = body?.textContent?.trim() || body?.content?.trim() || "";
  if (!preferred) return "";
  const withoutMarkup = body?.contentType === "html" || /<[^>]+>/.test(preferred)
    ? preferred
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/(?:div|p|li|blockquote|h[1-6])\s*>/gi, "\n")
        .replace(/<li\b[^>]*>/gi, "- ")
        .replace(/<[^>]*>/g, " ")
    : preferred;
  return decodeHtmlEntities(withoutMarkup)
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 8_000);
}

export function parseTeamsMessageAction(value: unknown): ParsedTeamsMessageAction {
  const activity = (value || {}) as TeamsMessageActionActivity;
  const activityValue = activity.value;
  if (
    activity.type !== "invoke"
    || activity.name !== "composeExtension/fetchTask"
    || (activity.channelId && activity.channelId !== "msteams")
    || !activityValue
    || !["compose", "message"].includes(activityValue.commandContext || "")
  ) {
    throw new TeamsMessageActionError("unsupported_activity", "This Teams action is not supported.");
  }

  const commandId = activityValue.commandId || "";
  const intent = TEAMS_ACTION_COMMANDS[commandId as keyof typeof TEAMS_ACTION_COMMANDS];
  if (!intent) throw new TeamsMessageActionError("unsupported_command", "This Beckett action is not available.");

  const aadObjectId = activity.from?.aadObjectId?.trim() || "";
  if (!aadObjectId) {
    throw new TeamsMessageActionError("teams_identity_missing", "Teams did not provide a Microsoft account identity.");
  }

  const messageText = normalizeTeamsSelectedMessage(activityValue.messagePayload?.body);
  if (!messageText) {
    throw new TeamsMessageActionError("selected_message_missing", "Beckett could not read text from the selected message.");
  }

  return {
    activityId: activity.id?.trim() || crypto.randomUUID(),
    aadObjectId,
    tenantId: activity.channelData?.tenant?.id?.trim() || activity.conversation?.tenantId?.trim() || null,
    conversationType: activity.conversation?.conversationType?.trim() || null,
    intent,
    messageText,
  };
}

export function buildTeamsTaskDialogResponse(url: string, intent: TeamsActionIntent) {
  return {
    task: {
      type: "continue" as const,
      value: {
        title: intent === "decode" ? "Decode with Beckett" : "Draft a response with Beckett",
        height: "large" as const,
        width: "medium" as const,
        url,
        fallbackUrl: url,
      },
    },
  };
}

export function buildTeamsTaskErrorResponse(message: string) {
  return { task: { type: "message" as const, value: message } };
}
