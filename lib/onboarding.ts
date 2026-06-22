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
