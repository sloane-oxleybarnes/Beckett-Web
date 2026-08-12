import type { SlackCoachingIntent } from "@/lib/slack-app";

export type SlackEventEnvelope = {
  type?: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type?: string;
    tab?: string;
    channel_type?: string;
    channel?: string;
    user?: string;
    bot_id?: string;
    subtype?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    action_token?: string;
    context?: {
      entities?: Array<{ type?: string; value?: string; team_id?: string }>;
    };
  };
};

export function extractActiveSlackContext(event: NonNullable<SlackEventEnvelope["event"]>) {
  const channelEntity = event.context?.entities?.find((entity) => entity.type?.includes("channel_id") && entity.value);
  const userEntity = event.context?.entities?.find((entity) => entity.type?.includes("user_id") && entity.value);
  return {
    channelId: channelEntity?.value || null,
    userId: userEntity?.value || null,
    actionToken: event.action_token || null,
  };
}

export function inferAssistantIntent(text: string): SlackCoachingIntent {
  const normalized = text.toLowerCase();
  if (/\b(relationship|history|pattern|vibe|dynamic|overall|usually|typically|how are things with|where.*stand|what.*between us|context with|relationship like|overly harsh|too harsh|mixed review|mostly critical|overly critical|was this fair|how did that land)\b/i.test(text)) return "relationship";
  if (normalized.includes("decode") || normalized.includes("understand this message") || normalized.includes("over-reading")) return "decode";
  if (normalized.includes("rewrite") || normalized.includes("clearer and kinder")) return "rewrite";
  if (normalized.includes("draft") || normalized.includes("respond") || normalized.includes("clear response")) return "respond";
  if (normalized.includes("practice")) return "practice";
  if (normalized.includes("prepare") || normalized.includes("prep")) return "prep";
  return "general";
}

export function isSlackRetrievalRequest(text: string) {
  return /\b(what did we (?:decide|agree)|what was decided|did we (?:delay|move|change)|when (?:is|was|did).*launch|find (?:the|our).*decision|what happened with)\b/i.test(text);
}

export function isSlackIdentityRequest(text: string) {
  return /^(?:who am i(?: in slack)?|what(?:'s| is) my (?:name|slack identity)|do you know who i am)\??$/i.test(text.trim());
}

function slackTimestampFromPermalink(value: string | null | undefined) {
  if (!value) return null;
  const decoded = decodeURIComponent(value).trim().replace(/^p/i, "");
  if (/^\d{10,}\.\d{1,6}$/.test(decoded)) return decoded;
  const digits = decoded.replace(/\D/g, "");
  if (digits.length <= 10) return null;
  return `${digits.slice(0, -6)}.${digits.slice(-6)}`;
}

export function extractSlackPermalinkContext(text: string) {
  const match = text.replace(/&amp;/g, "&").match(/https?:\/\/[^\s>|]+\/archives\/[A-Z0-9]+\/p\d{10,}(?:\?[^\s>|]+)?/i);
  if (!match) return null;

  try {
    const url = new URL(match[0]);
    const parts = url.pathname.split("/").filter(Boolean);
    const archiveIndex = parts.indexOf("archives");
    const channelId = archiveIndex >= 0 ? parts[archiveIndex + 1] : null;
    const messageTs = slackTimestampFromPermalink(archiveIndex >= 0 ? parts[archiveIndex + 2] : null);
    const threadTs = slackTimestampFromPermalink(url.searchParams.get("thread_ts"));
    if (!channelId || !messageTs) return null;
    return { channelId, messageTs, threadTs, url: match[0] };
  } catch {
    return null;
  }
}
