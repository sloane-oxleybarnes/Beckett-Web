export const MOBILE_RESULT_CONTRACT_VERSION = "2026-10-08" as const;

export const mobileCoachActions = ["decode", "respond", "rewrite", "clarify", "tone_check"] as const;
export type MobileCoachAction = (typeof mobileCoachActions)[number];

export type MobileInterpretationResult = {
  type: "interpretation";
  summary: string;
  clearSignals: string[];
  possibleReadings: Array<{
    label: string;
    explanation: string;
    evidence: string;
    confidence: "low" | "medium" | "high";
  }>;
  uncertainties: string[];
  usefulQuestions: string[];
};

export type MobileDraftOptionsResult = {
  type: "draft_options";
  contextSummary: string;
  preservedIntent: string[];
  originalFeedback: {
    tone: string;
    clarity: string;
    strengths: string[];
    watchFor: string[];
  } | null;
  options: Array<{
    style: "direct" | "warm" | "balanced";
    label: string;
    text: string;
    rationale: string;
  }>;
  uncertaintyNote: string | null;
};

export type MobileToneFeedbackResult = {
  type: "tone_feedback";
  likelyLanding: string;
  strengths: string[];
  watchFor: string[];
  revision: {
    text: string;
    changes: string[];
  } | null;
};

export type MobileCoachResult =
  | MobileInterpretationResult
  | MobileDraftOptionsResult
  | MobileToneFeedbackResult;

export const mobileUserVoiceInstruction = `Write every coaching explanation directly to the user using "you" and "your." Never refer to the user by their preferred name or describe the user with third-person pronouns. Suggested messages must be written from the user's perspective in first person ("I" and "my"), unless the user explicitly asks for another voice.`;

export function isMobileCoachAction(value: unknown): value is MobileCoachAction {
  return typeof value === "string" && mobileCoachActions.includes(value as MobileCoachAction);
}

export function resultTypeForMobileAction(action: MobileCoachAction): MobileCoachResult["type"] {
  if (action === "decode") return "interpretation";
  if (action === "tone_check") return "tone_feedback";
  return "draft_options";
}

function cleanText(value: unknown, fallback = "", maxLength = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : fallback;
}

function cleanList(value: unknown, maxItems = 6, maxLength = 500) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, "", maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeMobileCoachResult(
  action: MobileCoachAction,
  value: unknown,
): MobileCoachResult {
  const record = asRecord(value);
  const expectedType = resultTypeForMobileAction(action);

  if (expectedType === "interpretation") {
    const possibleReadings = Array.isArray(record.possibleReadings)
      ? record.possibleReadings.slice(0, 3).map((item) => {
          const reading = asRecord(item);
          const rawConfidence = cleanText(reading.confidence).toLowerCase();
          const confidence: "low" | "medium" | "high" = rawConfidence === "high" || rawConfidence === "medium"
            ? rawConfidence
            : "low";
          return {
            label: cleanText(reading.label, "Possible reading", 50),
            explanation: cleanText(reading.explanation, "This interpretation is uncertain.", 160),
            evidence: cleanText(reading.evidence, "No specific wording identified.", 120),
            confidence,
          };
        })
      : [];

    return {
      type: "interpretation",
      summary: cleanText(record.summary, "Beckett could not summarize this message.", 220),
      clearSignals: cleanList(record.clearSignals, 3, 120),
      possibleReadings,
      uncertainties: cleanList(record.uncertainties, 2, 120),
      usefulQuestions: [],
    };
  }

  if (expectedType === "tone_feedback") {
    const revision = asRecord(record.revision);
    const revisionText = cleanText(revision.text, "", 2_000);
    return {
      type: "tone_feedback",
      likelyLanding: cleanText(record.likelyLanding, "The likely tone is uncertain without more context.", 700),
      strengths: cleanList(record.strengths),
      watchFor: cleanList(record.watchFor),
      revision: revisionText
        ? { text: revisionText, changes: cleanList(revision.changes, 6, 300) }
        : null,
    };
  }

  const validStyles = new Set(["direct", "warm", "balanced"]);
  const feedback = asRecord(record.originalFeedback);
  const originalFeedback = action === "rewrite"
    ? {
        tone: cleanText(feedback.tone, "Tone feedback was not available.", 180),
        clarity: cleanText(feedback.clarity, "Clarity feedback was not available.", 180),
        strengths: cleanList(feedback.strengths, 2, 120),
        watchFor: cleanList(feedback.watchFor, 2, 120),
      }
    : null;
  const options = Array.isArray(record.options)
    ? record.options.slice(0, 3).map((item, index) => {
        const option = asRecord(item);
        const rawStyle = cleanText(option.style).toLowerCase();
        const fallbackStyle = (["direct", "warm", "balanced"] as const)[index] || "balanced";
        const style = validStyles.has(rawStyle)
          ? rawStyle as "direct" | "warm" | "balanced"
          : fallbackStyle;
        return {
          style,
          label: cleanText(option.label, `${style[0].toUpperCase()}${style.slice(1)}`, 80),
          text: cleanText(option.text, "", 360),
          rationale: cleanText(option.rationale, "Preserves the user's intent.", 120),
        };
      }).filter((option) => option.text)
    : [];

  return {
    type: "draft_options",
    contextSummary: cleanText(record.contextSummary, "Draft options based on the context provided.", 180),
    preservedIntent: cleanList(record.preservedIntent, 2, 120),
    originalFeedback,
    options,
    uncertaintyNote: cleanText(record.uncertaintyNote, "", 180) || null,
  };
}

export function mobileResultJsonInstruction(action: MobileCoachAction) {
  const type = resultTypeForMobileAction(action);
  if (type === "interpretation") {
    return `Return only valid JSON with this exact shape:
{"type":"interpretation","summary":"string","clearSignals":["string"],"possibleReadings":[{"label":"string","explanation":"string","evidence":"specific words or pattern from the message","confidence":"low|medium|high"}],"uncertainties":["string"],"usefulQuestions":["string"]}
Keep the summary to one or two short sentences. Include no more than three clear signals, three possible readings, and two uncertainties. Return an empty usefulQuestions array because Decode must not add unsolicited next steps. Keep every list item to one short sentence. Separate observable wording from interpretation. Confidence describes evidentiary support, not certainty about another person's intent.`;
  }
  if (type === "tone_feedback") {
    return `Return only valid JSON with this exact shape:
{"type":"tone_feedback","likelyLanding":"string","strengths":["string"],"watchFor":["string"],"revision":{"text":"string","changes":["string"]}|null}
Preserve the user's meaning and boundaries. If no revision is needed, return null for revision.`;
  }
  if (action === "rewrite") {
    return `Return only valid JSON with this exact shape:
{"type":"draft_options","contextSummary":"one short sentence","preservedIntent":[],"originalFeedback":{"tone":"one short sentence","clarity":"one short sentence","strengths":["short phrase"],"watchFor":["short phrase"]},"options":[{"style":"direct","label":"Clear","text":"string","rationale":"string"},{"style":"warm","label":"Warmer","text":"string","rationale":"string"},{"style":"balanced","label":"More concise","text":"string","rationale":"string"}],"uncertaintyNote":null}
Briefly assess the user's original draft before rewriting it. Keep tone and clarity to one short sentence each, with no more than two short strengths and two short watch-outs. Return exactly three editable rewrites. Keep each rewrite under 45 words. Preserve the user's intent, facts, boundaries, promises, and voice. Do not claim to send anything.`;
  }
  return `Return only valid JSON with this exact shape:
{"type":"draft_options","contextSummary":"string","preservedIntent":["string"],"originalFeedback":null,"options":[{"style":"direct","label":"Direct","text":"string","rationale":"string"},{"style":"warm","label":"Warm","text":"string","rationale":"string"},{"style":"balanced","label":"Balanced","text":"string","rationale":"string"}],"uncertaintyNote":"string or null"}
Return exactly three ready-to-send replies and no additional coaching. Keep each reply under 45 words. Each reply must move the conversation forward rather than repeat or paraphrase the incoming message. Preserve the user's intent, facts, boundaries, and voice. Write each rationale directly to the user using "you" and "your," never the user's name or third-person pronouns. Do not claim to send anything.`;
}
