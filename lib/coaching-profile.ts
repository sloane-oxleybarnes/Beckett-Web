import type { SupabaseClient } from "@supabase/supabase-js";

type CoachingProfileRow = {
  display_name?: string | null;
  first_name?: string | null;
  full_name?: string | null;
  strengths?: string[] | null;
  workplace_triggers?: string[] | null;
  communication_preferences?: string[] | null;
  coaching_tone?: string | null;
  neurodivergent_context?: string[] | null;
  neurodivergent_context_other?: string | null;
  pattern_model_enabled?: boolean | null;
};

type ToolkitRow = {
  course_id?: string | null;
  category?: string | null;
  label?: string | null;
  content?: string | null;
};

type PatternObservationRow = {
  label?: string | null;
  evidence_summary?: string | null;
  coaching_note?: string | null;
};

export type CoachingProfileDirectiveId =
  | "social_context"
  | "next_steps"
  | "advocacy"
  | "warmer_drafts"
  | "concise_drafts"
  | "direct_drafts";

export type CoachingProfileLengthClass = "short" | "standard" | "detailed";

export type CoachingToneContract = {
  label: string;
  minimumWords: number;
  targetWords: readonly [number, number];
  maximumWords: number;
  quickCharacterLimit: number;
  requirements: readonly string[];
};

export type CoachingProfileInstrumentation = {
  profileIncluded: boolean;
  tone: string | null;
  directiveIds: CoachingProfileDirectiveId[];
  preferenceCount: number;
  responseLengthClass: CoachingProfileLengthClass;
};

const toneLabels = new Map<string, string>([
  ["direct_kind", "Direct but kind"],
  ["gentle_reassuring", "Gentle and reassuring"],
  ["blunt_practical", "Blunt and practical"],
  ["detailed_explanatory", "Detailed and explanatory"],
  ["short_concise", "Short and concise"],
]);

export const coachingToneContracts: Record<string, CoachingToneContract> = {
  direct_kind: {
    label: "Direct but kind",
    minimumWords: 65,
    targetWords: [70, 95],
    maximumWords: 120,
    quickCharacterLimit: 950,
    requirements: [
      "State the defensible read clearly.",
      "Correct over-reading with respectful, low-shame language.",
      "Give one concrete action and one short example when useful.",
    ],
  },
  gentle_reassuring: {
    label: "Gentle and reassuring",
    minimumWords: 80,
    targetWords: [90, 115],
    maximumWords: 140,
    quickCharacterLimit: 1100,
    requirements: [
      "Explicitly validate why the uncertainty is understandable.",
      "Use noticeable emotional cushioning and grounded encouragement.",
      "Preserve uncertainty and never invent reassurance.",
      "End with one manageable next action.",
    ],
  },
  blunt_practical: {
    label: "Blunt and practical",
    minimumWords: 45,
    targetWords: [50, 70],
    maximumWords: 90,
    quickCharacterLimit: 700,
    requirements: [
      "Lead with the bottom line.",
      "Use minimal reassurance and no unnecessary explanation.",
      "Give the immediate action.",
    ],
  },
  detailed_explanatory: {
    label: "Detailed and explanatory",
    minimumWords: 150,
    targetWords: [170, 210],
    maximumWords: 235,
    quickCharacterLimit: 1750,
    requirements: [
      "Explain the visible evidence and what remains uncertain.",
      "Explain relevant hierarchy, timing, ownership, or social logic.",
      "Explain why the recommended action works.",
      "Use compact bullets when they improve scanning.",
    ],
  },
  short_concise: {
    label: "Short and concise",
    minimumWords: 20,
    targetWords: [25, 45],
    maximumWords: 60,
    quickCharacterLimit: 450,
    requirements: [
      "Include only the most defensible interpretation and immediate action.",
      "Do not add secondary theories or extra speculation, including upstream pressure, stakeholders, protective cover, or an unmentioned motive.",
      "Include suggested wording only when requested or clearly useful.",
    ],
  },
};

export function coachingToneContract(tone?: string | null): CoachingToneContract | null {
  return tone ? coachingToneContracts[tone] || null : null;
}

export function formatCoachingToneContract(tone?: string | null) {
  const contract = coachingToneContract(tone);
  if (!contract) return "";
  return [
    `Output contract for ${contract.label}: target ${contract.targetWords[0]}-${contract.targetWords[1]} words for an initial Decode and never exceed ${contract.maximumWords} words unless safety requires otherwise.`,
    ...contract.requirements.map((requirement) => `- ${requirement}`),
  ].join("\n");
}

const toneInstructions = new Map<string, string>([
  [
    "direct_kind",
    "Coaching style: be clear and specific while using respectful, low-shame language. Name the practical issue directly, then give a kind, usable next step.",
  ],
  [
    "gentle_reassuring",
    "Coaching style: add noticeable emotional cushioning, validation, and low-shame framing. Acknowledge that ambiguity or tension can feel difficult, then give a concrete next step. Do not become vague, invent reassurance, or soften factual uncertainty.",
  ],
  [
    "blunt_practical",
    "Coaching style: lead with the bottom line. Be direct, action-focused, and economical; use minimal reassurance and move quickly to what the user can do next.",
  ],
  [
    "detailed_explanatory",
    "Coaching style: explain the visible cues, the social logic behind plausible interpretations, and why the recommended next move helps. Use compact bullets and clear structure so the added context remains easy to scan.",
  ],
  [
    "short_concise",
    "Coaching style: keep only the bottom line and the most useful next action. Remove background explanation unless it is required for safety or uncertainty.",
  ],
]);

function preferenceDirectiveId(value: string): CoachingProfileDirectiveId | null {
  const normalized = value.toLowerCase();
  if (/social context|social logic|subtext/.test(normalized)) return "social_context";
  if (/what to do next|choose what to do|next step/.test(normalized)) return "next_steps";
  if (/advocat|speak up for|state my needs/.test(normalized)) return "advocacy";
  if (/warm/.test(normalized)) return "warmer_drafts";
  if (/concis|shorter|brief/.test(normalized)) return "concise_drafts";
  if (/more direct|directer|less indirect/.test(normalized)) return "direct_drafts";
  return null;
}

const preferenceInstructions: Record<CoachingProfileDirectiveId, string> = {
  social_context:
    "Explain relevant social context inside the normal analysis: connect wording, timing, hierarchy, or conversational norms to the likely read. Do not replace the basic Decode or Respond answer with a separate social-context essay.",
  next_steps: "Always make the next practical choice or action explicit.",
  advocacy:
    "Help the user state needs, limits, or requests without apologizing away the substance. Preserve their agency and legitimate boundary.",
  warmer_drafts:
    "Suggested wording written for the user should sound warmer and more collaborative while preserving the request and boundary.",
  concise_drafts:
    "Suggested wording written for the user must be concise. This preference limits the user's drafts, not the detail of Beckett's coaching explanation.",
  direct_drafts:
    "Suggested wording written for the user should make the request, decision, or boundary more direct without becoming harsh.",
};

export function coachingProfileLengthClass(tone?: string | null): CoachingProfileLengthClass {
  if (tone === "detailed_explanatory") return "detailed";
  if (tone === "short_concise") return "short";
  return "standard";
}

export function buildCoachingProfileBehavior(profile?: CoachingProfileRow | null) {
  const preferences = (profile?.communication_preferences || []).filter(
    (value): value is string => typeof value === "string" && Boolean(value.trim())
  );
  const directiveIds = Array.from(
    new Set(preferences.map(preferenceDirectiveId).filter((value): value is CoachingProfileDirectiveId => Boolean(value)))
  );
  const tone = profile?.coaching_tone || null;
  const responseLengthClass = coachingProfileLengthClass(tone);
  const behaviorLines = [
    tone
      ? toneInstructions.get(tone) || `Coaching style: honor the user's selected tone, ${toneLabels.get(tone as never) || tone}.`
      : null,
    formatCoachingToneContract(tone),
    ...directiveIds.map((id) => preferenceInstructions[id]),
    tone === "detailed_explanatory" && directiveIds.includes("concise_drafts")
      ? "Conflict resolution: give detailed, explanatory coaching in compact bullets, while keeping every proposed message for the user short. Do not shorten the analysis merely because the user's own drafts should be concise."
      : null,
    "Profile preferences never override truthfulness, uncertainty, privacy, authorization, safety, or the user's current request.",
  ].filter(Boolean) as string[];

  return {
    behaviorLines,
    instrumentation: {
      profileIncluded: Boolean(tone || preferences.length),
      tone,
      directiveIds,
      preferenceCount: preferences.length,
      responseLengthClass,
    } satisfies CoachingProfileInstrumentation,
  };
}

export function cleanToolkitContent(value: unknown, max = 220) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 3).trim()}...` : cleaned;
}

export function formatToolkitItemsForPrompt(items: ToolkitRow[] = [], limit = 5) {
  const lines = items
    .map((item) => {
      const content = cleanToolkitContent(item.content);
      if (!content) return null;
      const label = item.label || item.category || "Saved phrase";
      return `- ${label}: "${content}"`;
    })
    .filter(Boolean)
    .slice(0, limit);

  return lines.length
    ? `Saved Communication Toolkit phrases the user may want Beckett to reuse or adapt:\n${lines.join("\n")}`
    : "";
}

export function formatCoachingProfileForPrompt(
  profile?: CoachingProfileRow | null,
  toolkitItems: ToolkitRow[] = [],
  patternObservations: PatternObservationRow[] = [],
) {
  if (!profile) return formatToolkitItemsForPrompt(toolkitItems);

  const behavior = buildCoachingProfileBehavior(profile);

  const lines = [
    profile.display_name || profile.first_name || profile.full_name
      ? `Preferred name: ${profile.display_name || profile.first_name || profile.full_name}.`
      : null,
    profile.communication_preferences?.length
      ? `What the user wants Beckett to help with: ${profile.communication_preferences.join(", ")}.`
      : null,
    profile.coaching_tone
      ? `Preferred coaching tone: ${toneLabels.get(profile.coaching_tone as never) || profile.coaching_tone}.`
      : null,
    ...behavior.behaviorLines,
    profile.strengths?.length
      ? `Communication strengths to preserve: ${profile.strengths.join(", ")}.`
      : null,
    profile.workplace_triggers?.length
      ? `Moments to handle carefully: ${profile.workplace_triggers.join(", ")}.`
      : null,
    profile.neurodivergent_context?.length || profile.neurodivergent_context_other
      ? `Optional neurodivergent context: ${[
          ...(profile.neurodivergent_context || []).filter((item) => item !== "Something else"),
          profile.neurodivergent_context_other || null,
        ].filter(Boolean).join(", ")}.`
      : null,
    formatToolkitItemsForPrompt(toolkitItems),
    profile.pattern_model_enabled && patternObservations.length
      ? `Opt-in communication patterns inferred from prior user-selected interactions. Treat these as preferences to preserve, not fixed traits:\n${patternObservations
          .map((observation) => `- ${observation.label || "Observed style"}: ${observation.coaching_note || observation.evidence_summary || ""}`)
          .join("\n")}`
      : null,
  ].filter(Boolean);

  return lines.length
    ? `User coaching profile. These instructions have priority over generic brevity preferences, while the invariant safety and uncertainty rules still win. Apply them to the current answer without mentioning the profile.\n${lines.join("\n")}`
    : "";
}

export async function fetchCoachingProfileContext(
  supabase: SupabaseClient,
  userId: string,
  options: { includeToolkit?: boolean; toolkitLimit?: number } = {}
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, first_name, full_name, strengths, workplace_triggers, communication_preferences, coaching_tone, neurodivergent_context, neurodivergent_context_other, pattern_model_enabled"
    )
    .eq("id", userId)
    .maybeSingle();

  let toolkitItems: ToolkitRow[] = [];
  if (options.includeToolkit !== false) {
    const { data } = await supabase
      .from("course_toolkit_items")
      .select("course_id, category, label, content, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(options.toolkitLimit || 6);
    toolkitItems = data || [];
  }

  let patternObservations: PatternObservationRow[] = [];
  if ((profile as CoachingProfileRow | null)?.pattern_model_enabled) {
    const { data } = await supabase
      .from("user_pattern_observations")
      .select("label, evidence_summary, coaching_note, updated_at")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(3);
    patternObservations = data || [];
  }

  return {
    profile: profile as CoachingProfileRow | null,
    toolkitItems,
    patternObservations,
    promptContext: formatCoachingProfileForPrompt(
      profile as CoachingProfileRow | null,
      toolkitItems,
      patternObservations,
    ),
  };
}
