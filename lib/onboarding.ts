export const strengthOptions = [
  "I am direct and honest",
  "I am a good listener",
  "I think before I speak",
  "I notice patterns others miss",
  "I am deeply empathetic",
  "I am creative in how I express myself",
  "I am loyal and consistent",
  "I bring focus and intensity when I care",
];

export const workplaceTriggerOptions = [
  "Vague or unclear feedback",
  "Feeling interrupted or talked over",
  "Unexpected changes to plans",
  "Passive aggression or indirect communication",
  "Feeling like I am being criticized",
  "Conflict or raised voices",
  "Not knowing what is expected of me",
  "Feeling like I have to mask or perform",
  "Slack messages that feel urgent or ambiguous",
  "Long email threads with unclear ownership",
];

export const communicationPreferenceOptions = [
  "Being more direct",
  "Advocating for my needs",
  "Understanding the social context",
  "Understanding what to do next",
  "Being warmer in my responses",
  "Being more concise",
];

export const strengthRatingOptions = [
  { value: "not_usually", label: "Not usually" },
  { value: "sometimes", label: "Sometimes" },
  { value: "often", label: "Often" },
  { value: "core_strength", label: "A core strength" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export const workplaceEffortRatingOptions = [
  { value: "little_or_none", label: "Little or none" },
  { value: "some", label: "Some" },
  { value: "moderate", label: "Moderate" },
  { value: "a_lot", label: "A lot" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export const coachingPriorityRatingOptions = [
  { value: "not_priority", label: "Not a priority" },
  { value: "occasionally_useful", label: "Occasionally useful" },
  { value: "important", label: "Important" },
  { value: "top_priority", label: "A top priority" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export const coachingStyleDimensions = [
  { id: "directness", label: "Directness" },
  { id: "emotional_reassurance", label: "Emotional reassurance" },
  { id: "social_context_explanation", label: "Explanation of social context" },
  { id: "action_focused_next_steps", label: "Action-focused next steps" },
  { id: "concise_wording", label: "Concise wording" },
] as const;

export const coachingStyleRatingOptions = [
  { value: "less", label: "Less" },
  { value: "a_little", label: "A little" },
  { value: "moderate", label: "A moderate amount" },
  { value: "more", label: "More" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export const coachingToneOptions = [
  {
    value: "direct_kind",
    label: "Direct but kind",
    description: "Clear, specific, low-shame feedback. Beckett's default.",
  },
  {
    value: "gentle_reassuring",
    label: "Gentle and reassuring",
    description: "More emotional cushioning and encouragement.",
  },
  {
    value: "blunt_practical",
    label: "Blunt and practical",
    description: "Very direct, action-focused, minimal reassurance.",
  },
  {
    value: "detailed_explanatory",
    label: "Detailed and explanatory",
    description: "More context about the social logic behind suggestions.",
  },
  {
    value: "short_concise",
    label: "Short and concise",
    description: "Minimal text, just what to say or do next.",
  },
] as const;

export const neurodivergentContextOptions = [
  "ADHD",
  "Autism",
  "Dyslexia",
  "Sensory processing differences",
  "Social processing differences",
  "Anxiety affects my communication",
  "Something else",
];

export type CoachingTone = (typeof coachingToneOptions)[number]["value"];
export type StrengthRating = (typeof strengthRatingOptions)[number]["value"];
export type WorkplaceEffortRating = (typeof workplaceEffortRatingOptions)[number]["value"];
export type CoachingPriorityRating = (typeof coachingPriorityRatingOptions)[number]["value"];
export type CoachingStyleRating = (typeof coachingStyleRatingOptions)[number]["value"];
export type RatingMap<T extends string> = Record<string, T>;

export function normalizeRatingMap<T extends string>(
  input: unknown,
  expectedKeys: readonly string[],
  allowedValues: readonly T[],
): RatingMap<T> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  return Object.fromEntries(
    expectedKeys.flatMap((key) => {
      const value = source[key];
      return typeof value === "string" && allowedValues.includes(value as T)
        ? [[key, value as T]]
        : [];
    }),
  );
}

export function hasCompleteRatingMap<T extends string>(
  ratings: RatingMap<T>,
  expectedKeys: readonly string[],
) {
  return expectedKeys.every((key) => Boolean(ratings[key]));
}

export function ratingMapFromLegacySelections<T extends string>(
  options: readonly string[],
  selections: readonly string[] | null | undefined,
  selectedValue: T,
  unselectedValue: T,
): RatingMap<T> {
  const selected = new Set(selections || []);
  return Object.fromEntries(
    options.map((option) => [option, selected.has(option) ? selectedValue : unselectedValue]),
  );
}

export function coachingStyleRatingsFromTone(
  tone: CoachingTone | string | null | undefined,
): RatingMap<CoachingStyleRating> {
  const presets: Record<CoachingTone, RatingMap<CoachingStyleRating>> = {
    direct_kind: {
      directness: "more",
      emotional_reassurance: "moderate",
      social_context_explanation: "moderate",
      action_focused_next_steps: "more",
      concise_wording: "moderate",
    },
    gentle_reassuring: {
      directness: "a_little",
      emotional_reassurance: "more",
      social_context_explanation: "moderate",
      action_focused_next_steps: "moderate",
      concise_wording: "a_little",
    },
    blunt_practical: {
      directness: "more",
      emotional_reassurance: "less",
      social_context_explanation: "a_little",
      action_focused_next_steps: "more",
      concise_wording: "more",
    },
    detailed_explanatory: {
      directness: "moderate",
      emotional_reassurance: "moderate",
      social_context_explanation: "more",
      action_focused_next_steps: "more",
      concise_wording: "less",
    },
    short_concise: {
      directness: "moderate",
      emotional_reassurance: "a_little",
      social_context_explanation: "less",
      action_focused_next_steps: "more",
      concise_wording: "more",
    },
  };
  return presets[tone as CoachingTone] || presets.direct_kind;
}

function preferredItems<T extends string>(
  options: readonly string[],
  ratings: RatingMap<T>,
  primaryValues: readonly T[],
  fallbackValue: T,
) {
  const primary = options.filter((option) => primaryValues.includes(ratings[option]));
  return primary.length ? primary : options.filter((option) => ratings[option] === fallbackValue);
}

export function deriveLegacyCoachingProfile({
  strengthRatings,
  workplaceEffortRatings,
  coachingPriorityRatings,
  coachingStyleRatings,
}: {
  strengthRatings: RatingMap<StrengthRating>;
  workplaceEffortRatings: RatingMap<WorkplaceEffortRating>;
  coachingPriorityRatings: RatingMap<CoachingPriorityRating>;
  coachingStyleRatings: RatingMap<CoachingStyleRating>;
}) {
  const score: Record<CoachingStyleRating, number> = {
    less: 0,
    a_little: 1,
    moderate: 2,
    more: 3,
    unsure: 1,
  };
  const styleScore = (id: string) => score[coachingStyleRatings[id] || "unsure"];
  const explanation = styleScore("social_context_explanation");
  const concise = styleScore("concise_wording");
  const reassurance = styleScore("emotional_reassurance");
  const directness = styleScore("directness");
  const action = styleScore("action_focused_next_steps");

  let coachingTone: CoachingTone = "direct_kind";
  if (explanation >= 3 && explanation >= concise) coachingTone = "detailed_explanatory";
  else if (concise >= 3 && concise > explanation) coachingTone = "short_concise";
  else if (reassurance >= 3 && directness <= 1) coachingTone = "gentle_reassuring";
  else if (directness >= 3 && action >= 3 && reassurance <= 1) coachingTone = "blunt_practical";

  return {
    strengths: preferredItems(
      strengthOptions,
      strengthRatings,
      ["often", "core_strength"],
      "sometimes",
    ),
    workplaceTriggers: preferredItems(
      workplaceTriggerOptions,
      workplaceEffortRatings,
      ["moderate", "a_lot"],
      "some",
    ),
    communicationPreferences: preferredItems(
      communicationPreferenceOptions,
      coachingPriorityRatings,
      ["important", "top_priority"],
      "occasionally_useful",
    ),
    coachingTone,
  };
}
