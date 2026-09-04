export function slackPracticeGoalQuestion(person?: string | null) {
  return [
    `Got it. I’ll role-play as ${person || "the other person"}.`,
    "",
    "What do you want to practice getting better at?",
    "For example: staying direct, not over-apologizing, handling pushback, or asking for clarity.",
  ].join("\n");
}

export const SLACK_PRACTICE_INTENT_RULE =
  "Practice responses must say practice or role-play, never prep, unless explicitly referring to previously completed Prep context.";
