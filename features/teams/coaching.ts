import { callAnthropic } from "@/lib/anthropic";
import { parseJsonObject } from "@/lib/ai-json";
import { withAiMetering } from "@/lib/ai-metering";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { trackBetaEvent } from "@/lib/beta-events";
import type { TeamsActionIntent } from "./contracts";

export type TeamsDecodeResult = {
  intent: "decode";
  possibleRead: string;
  visibleEvidence: string;
  uncertainty: string;
  nextMove: string;
};

export type TeamsDraftResult = {
  intent: "draft";
  shortRead: string;
  drafts: Array<{ label: string; text: string }>;
};

export type TeamsCoachingResult = TeamsDecodeResult | TeamsDraftResult;

function clean(value: unknown, max = 700) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function normalizeResult(raw: unknown, intent: TeamsActionIntent): TeamsCoachingResult {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  if (intent === "decode") {
    return {
      intent,
      possibleRead: clean(value.possibleRead) || "The wording may be straightforward, but the available text is not enough to know the sender’s full intent.",
      visibleEvidence: clean(value.visibleEvidence) || "Use the specific words, request, and level of urgency that are visible in the message.",
      uncertainty: clean(value.uncertainty) || "Tone and intent cannot be confirmed from one selected message.",
      nextMove: clean(value.nextMove) || "Respond to the explicit request and clarify anything that would change your next step.",
    };
  }

  const candidates = Array.isArray(value.drafts) ? value.drafts : [];
  const defaults = ["Direct and clear", "Warm and collaborative", "Gentle limit"];
  const drafts = defaults.map((label, index) => {
    const candidate = candidates[index] && typeof candidates[index] === "object"
      ? candidates[index] as Record<string, unknown>
      : {};
    return { label, text: clean(candidate.text, 500) };
  }).filter((draft) => draft.text);
  if (!drafts.length) throw new Error("Teams draft generation did not return usable options");
  return {
    intent,
    shortRead: clean(value.shortRead) || "Choose the option that best matches your relationship and what you can commit to.",
    drafts,
  };
}

export async function runTeamsMessageCoaching(input: {
  userId: string;
  requestId: string;
  intent: TeamsActionIntent;
  messageText: string;
  profileContext?: string | null;
}) {
  const intentContract = input.intent === "decode"
    ? `Return JSON with exactly these string fields: possibleRead, visibleEvidence, uncertainty, nextMove.
Possible read must be a cautious interpretation, not a claim about hidden intent. Visible evidence must cite only wording present in the selected message. Uncertainty must name a plausible alternative or what cannot be known. Next move must be practical and user-controlled. Keep the whole result under 170 words.`
    : `Return JSON with a shortRead string and a drafts array containing exactly three objects with a text string.
The drafts must be meaningfully different versions in this order: Direct and clear, Warm and collaborative, Gentle limit. Each draft must be ready to paste, no more than 35 words, and must not invent facts, dates, commitments, or relationship context.`;

  const system = `You are Beckett, a workplace communication coach for neurodivergent professionals, responding inside a private Microsoft Teams coaching dialog.
Analyze only the one message the user deliberately selected. Do not claim access to the surrounding chat, channel, history, reactions, attachments, meetings, or participants.
Never say that you saved the selected message. Never tell the user that a draft was sent. The user reviews, edits, copies, and sends any wording themselves.
Use plain language. Do not include markdown or commentary outside the requested JSON.
${intentContract}
${beckettBoundaryPrompt()}`;
  const prompt = `${input.profileContext || "The user has not saved additional coaching preferences."}

Selected Microsoft Teams message:
<selected_message>${input.messageText}</selected_message>`;

  const result = await withAiMetering({
    userId: input.userId,
    requestId: input.requestId,
    source: "teams",
    action: input.intent === "decode" ? "decode_selected_message" : "draft_response",
  }, async () => {
    const raw = await callAnthropic(system, [{ role: "user", content: prompt }], input.intent === "decode" ? 420 : 380);
    return normalizeResult(parseJsonObject<Record<string, unknown>>(raw), input.intent);
  });

  await trackBetaEvent({
    userId: input.userId,
    eventName: "analysis_completed",
    source: "teams_message_action",
    metadata: { intent: input.intent },
  });
  return result;
}
