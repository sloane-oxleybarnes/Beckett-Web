export type SlackInteractionPayload = {
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
      values?: Record<string, Record<string, {
        type?: string;
        value?: string;
        selected_user?: string;
        selected_conversation?: string;
        selected_option?: { value?: string; text?: { text?: string } };
      }>>;
    };
  };
  message?: {
    text?: string;
    user?: string;
    username?: string;
    ts?: string;
    thread_ts?: string;
    blocks?: Array<Record<string, unknown>>;
    files?: Array<Record<string, unknown>>;
    attachments?: Array<{ text?: string; fallback?: string }>;
  };
  channel?: { id?: string; name?: string };
};

export type MessageShortcutIntent = "decode" | "respond";

export function parseInteractionPayload(rawBody: string): SlackInteractionPayload | null {
  const payload = new URLSearchParams(rawBody).get("payload");
  if (!payload) return null;
  try {
    return JSON.parse(payload) as SlackInteractionPayload;
  } catch {
    return null;
  }
}

export function messageShortcutIntent(callbackId?: string | null): MessageShortcutIntent {
  return callbackId === "beckett_message_decode" ? "decode" : "respond";
}

export function buildShortcutPrompt(
  payload: SlackInteractionPayload,
  authorLabel?: string | null,
  intent: MessageShortcutIntent = "respond",
  requesterLabel?: string | null,
) {
  const author = authorLabel || payload.message?.username || null;
  const requester = requesterLabel?.trim() || "the Slack user asking Beckett";
  const requesterIsAuthor = Boolean(
    payload.user?.id && payload.message?.user && payload.user.id === payload.message.user
  );
  const channel = payload.channel?.name && payload.channel.name !== "directmessage" ? ` in #${payload.channel.name}` : "";
  const source = author ? ` from ${author}${channel}` : "";
  const identity = requesterIsAuthor
    ? `Requester Slack identity: ${requester}. The requester selected their own message.`
    : `Requester Slack identity: ${requester}. Selected-message author: ${author || "another Slack participant"}. These are different Slack users.`;
  if (intent === "decode") {
    return [
      identity,
      `Help me decode this message${source}.`,
      "What is visible, what might be underneath it, and what should I pay attention to?",
    ].join(" ");
  }
  return [
    identity,
    `Help me draft a response to this message${source}.`,
    "Give me a short read, the next move, and three Slack-ready response options.",
  ].join(" ");
}

export function extractMessageText(payload: SlackInteractionPayload) {
  const richText = (payload.message?.blocks || []).flatMap((block) => {
    if (block.type !== "rich_text" || !Array.isArray(block.elements)) return [];
    return (block.elements as Array<Record<string, unknown>>).flatMap((section) => {
      if (!Array.isArray(section.elements)) return [];
      return (section.elements as Array<Record<string, unknown>>).map((element) => {
        if (element.type === "text") return String(element.text || "");
        if (element.type === "emoji") return element.name ? `:${String(element.name)}:` : "";
        if (element.type === "link") return String(element.text || element.url || "");
        if (element.type === "user") return element.user_id ? `<@${String(element.user_id)}>` : "";
        return "";
      }).join("");
    });
  }).join("\n").replace(/\s+/g, " ").trim();
  if (richText) return richText;

  const mainText = payload.message?.text?.trim();
  if (mainText) return mainText;

  return payload.message?.attachments
    ?.map((attachment) => attachment.text || attachment.fallback || "")
    .join("\n")
    .trim() || "";
}

export function selectedMessageExcerpt(text: string, maxLength = 180) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length <= maxLength ? cleaned : `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

export function selectedMessageOpener(
  intent: MessageShortcutIntent,
  author: string,
  messageText: string,
  requesterIsAuthor = false,
) {
  const action = intent === "decode" ? "Decode" : "Respond";
  const source = requesterIsAuthor ? "your message" : `from ${author}`;
  return `${action} ${source}: “${selectedMessageExcerpt(messageText)}”`;
}

export function selectedMessageContextInstruction(
  intent: MessageShortcutIntent,
  surroundingContextAvailable: boolean,
) {
  if (surroundingContextAvailable) return "";
  return intent === "decode"
    ? "Surrounding Slack context was unavailable. Treat ambiguous words and references as unresolved: do not invent what they refer to. Briefly say the read is limited to the selected message and, when the missing context matters, ask the requester to reply in the private Beckett thread with the 1–3 messages immediately before it or a short paraphrase."
    : "Surrounding Slack context was unavailable. Base the drafts only on the selected message and briefly invite the requester to reply in the private Beckett thread with the 1–3 preceding messages if they would materially change the response.";
}

export function selectedMessageThreadReply({
  response,
  surroundingContextAvailable,
}: {
  response: string;
  surroundingContextAvailable: boolean;
}) {
  return [
    response.trim(),
    surroundingContextAvailable
      ? ""
      : "Need a more certain read? Reply here with the 1–3 messages immediately before this one, or briefly say what you were discussing.",
  ].filter(Boolean).join("\n\n");
}

export function shortcutSourceAckText() {
  return "Opened privately in Beckett.";
}
