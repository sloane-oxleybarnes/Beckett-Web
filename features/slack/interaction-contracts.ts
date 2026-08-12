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
) {
  const author = authorLabel || payload.message?.username || null;
  const channel = payload.channel?.name && payload.channel.name !== "directmessage" ? ` in #${payload.channel.name}` : "";
  const source = author ? ` from ${author}${channel}` : "";
  if (intent === "decode") {
    return [
      `Help me decode this message${source}.`,
      "What is visible, what might be underneath it, and what should I pay attention to?",
    ].join(" ");
  }
  return [
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

export function selectedMessageOpener(intent: MessageShortcutIntent, author: string, messageText: string) {
  return [
    intent === "decode" ? "Let’s read this message privately." : "Let’s draft a response privately.",
    `Selected message from ${author}: “${selectedMessageExcerpt(messageText)}”`,
    intent === "decode"
      ? "Reply in this thread so the message, read, and follow-ups stay together."
      : "Reply in this thread so the message, drafts, and follow-ups stay together.",
  ].join("\n\n");
}
