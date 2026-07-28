export type PracticeRecommendationSession = {
  situation?: string | null;
  goal?: string | null;
  completed_at?: string | null;
};

export type EarnedLearningRecommendation = {
  courseId: "asking-for-clarity" | "introducing-new-colleague" | "ask-someone-out";
  title: string;
  reason: string;
  href: string;
};

const recommendationOptions: Array<{
  courseId: EarnedLearningRecommendation["courseId"];
  title: string;
  href: string;
  keywords: RegExp;
  reason: string;
}> = [
  {
    courseId: "asking-for-clarity",
    title: "Asking for Clarity at Work",
    href: "/dashboard/courses/asking-for-clarity",
    keywords: /\b(clarif|unclear|understand|expectation|scope|question|follow[- ]?up)\b/i,
    reason: "You have returned to questions about clarity in more than one completed practice session.",
  },
  {
    courseId: "introducing-new-colleague",
    title: "Introducing yourself to a new colleague",
    href: "/dashboard/courses/introducing-new-colleague",
    keywords: /\b(introduc|new colleague|new team|first meeting|first impression|new role)\b/i,
    reason: "You have returned to starting or strengthening a working relationship in more than one completed practice session.",
  },
  {
    courseId: "ask-someone-out",
    title: "Asking someone out on a dating app",
    href: "/dashboard/courses/ask-someone-out",
    keywords: /\b(date|dating|ask.*out|match|app conversation)\b/i,
    reason: "You have returned to dating conversations in more than one completed practice session.",
  },
];

// Recommendations are intentionally earned: enough completed practice to make a
// pattern useful, an explicit learning opt-in, and no recommendation for a course
// the user has already started or completed.
export function findEarnedLearningRecommendation(
  sessions: PracticeRecommendationSession[],
  unavailableCourseIds: Set<string>,
): EarnedLearningRecommendation | null {
  if (sessions.length < 3) return null;
  for (const option of recommendationOptions) {
    if (unavailableCourseIds.has(option.courseId)) continue;
    const matchedSessions = sessions.filter((session) => option.keywords.test(`${session.situation || ""}\n${session.goal || ""}`)).length;
    if (matchedSessions >= 2) return option;
  }
  return null;
}
