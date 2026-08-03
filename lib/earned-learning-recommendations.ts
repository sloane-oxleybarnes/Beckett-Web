export type PracticeRecommendationSession = {
  situation?: string | null;
  goal?: string | null;
  completed_at?: string | null;
};

export type LearningRecommendationEvidence = {
  completedPracticeSessions: number;
  matchedPracticeSessions: number;
  savedSupportPreference: boolean;
  rememberedPattern: boolean;
  completedCourse: boolean;
};

export type EarnedLearningRecommendation = {
  key: string;
  kind: "course" | "practice";
  courseId: "asking-for-clarity" | "introducing-new-colleague" | "ask-someone-out";
  title: string;
  reason: string;
  why: string;
  href: string;
  actionLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  evidence: LearningRecommendationEvidence;
};

type RecommendationOption = {
  courseId: EarnedLearningRecommendation["courseId"];
  title: string;
  href: string;
  keywords: RegExp;
  practiceHref: string;
  practiceLabel: string;
  courseReason: string;
  practiceReason: string;
};

const recommendationOptions: RecommendationOption[] = [
  {
    courseId: "asking-for-clarity",
    title: "Asking for Clarity at Work",
    href: "/dashboard/courses/asking-for-clarity",
    keywords: /\b(clarif|unclear|understand|expectation|scope|question|follow[- ]?up)\b/i,
    practiceHref: "/dashboard/practice?mode=professional&scenario=Ask for clarity at work&goal=Ask for the detail I need without over-explaining.",
    practiceLabel: "Practice a clarifying question",
    courseReason: "You have returned to questions about clarity in more than one completed Practice session.",
    practiceReason: "You completed this skill. A short practice can help turn it into language you can use in the moment.",
  },
  {
    courseId: "introducing-new-colleague",
    title: "Introducing yourself to a new colleague",
    href: "/dashboard/courses/introducing-new-colleague",
    keywords: /\b(introduc|new colleague|new team|first meeting|first impression|new role)\b/i,
    practiceHref: "/dashboard/practice?mode=professional&scenario=Introduce yourself to a new colleague&goal=Practice a warm, clear introduction that feels like me.",
    practiceLabel: "Practice your introduction",
    courseReason: "You have returned to starting or strengthening a working relationship in more than one completed Practice session.",
    practiceReason: "You completed this skill. A short practice can help you try the approach in a situation that feels real.",
  },
  {
    courseId: "ask-someone-out",
    title: "Asking someone out on a dating app",
    href: "/dashboard/courses/ask-someone-out",
    keywords: /\b(date|dating|ask.*out|match|app conversation)\b/i,
    practiceHref: "/dashboard/practice?mode=personal&scenario=Ask someone out on a dating app&goal=Practice a clear, low-pressure invitation in my own voice.",
    practiceLabel: "Practice an invitation",
    courseReason: "You have returned to dating conversations in more than one completed Practice session.",
    practiceReason: "You completed this skill. A short practice can help you use the approach in your own voice.",
  },
];

export type EarnedLearningSignals = {
  sessions: PracticeRecommendationSession[];
  unavailableCourseIds: Set<string>;
  completedCourseIds: Set<string>;
  savedSupportPlanText?: string[];
  rememberedPatternText?: string[];
};

function matches(option: RecommendationOption, text: string[]) {
  return text.some((value) => option.keywords.test(value));
}

function evidenceFor(
  option: RecommendationOption,
  signals: EarnedLearningSignals,
  completedCourse: boolean,
) {
  const matchedPracticeSessions = signals.sessions.filter((session) => option.keywords.test(`${session.situation || ""}\n${session.goal || ""}`)).length;
  return {
    completedPracticeSessions: signals.sessions.length,
    matchedPracticeSessions,
    savedSupportPreference: matches(option, signals.savedSupportPlanText || []),
    rememberedPattern: matches(option, signals.rememberedPatternText || []),
    completedCourse,
  };
}

// A recommendation is intentionally earned from user-owned signals. It never
// uses Gmail, Calendar, Slack, or a guessed interpretation of a check-in.
// A saved support preference or a pattern the user chose to remember can only
// reinforce a topic that already appeared in completed Practice.
export function findEarnedLearningRecommendation(signals: EarnedLearningSignals): EarnedLearningRecommendation | null {
  for (const option of recommendationOptions) {
    if (signals.unavailableCourseIds.has(option.courseId)) continue;
    const evidence = evidenceFor(option, signals, false);
    const reinforcedByUserChoice = evidence.savedSupportPreference || evidence.rememberedPattern;
    const enoughRepeatedPractice = evidence.completedPracticeSessions >= 3 && evidence.matchedPracticeSessions >= 2;
    const enoughPracticePlusChoice = evidence.completedPracticeSessions >= 2 && evidence.matchedPracticeSessions >= 1 && reinforcedByUserChoice;

    if (enoughRepeatedPractice || enoughPracticePlusChoice) {
      const reason = enoughRepeatedPractice
        ? option.courseReason
        : "You practiced this once and saved a related preference or pattern. Beckett is offering this only as an optional next step.";
      return {
        key: `course:${option.courseId}`,
        kind: "course",
        courseId: option.courseId,
        title: option.title,
        reason,
        why: enoughRepeatedPractice
          ? `${evidence.matchedPracticeSessions} completed Practice sessions in the last three weeks touched this topic.`
          : "One completed Practice session and a choice you saved point to this topic.",
        href: option.href,
        actionLabel: "Explore this skill",
        secondaryHref: option.practiceHref,
        secondaryLabel: option.practiceLabel,
        evidence,
      };
    }
  }

  // Course completion is an explicit signal. It can earn one lightweight, linked
  // practice suggestion even when there is not yet enough repeated practice to
  // infer a broader pattern.
  for (const option of recommendationOptions) {
    if (!signals.completedCourseIds.has(option.courseId)) continue;
    const evidence = evidenceFor(option, signals, true);
    return {
      key: `practice:${option.courseId}`,
      kind: "practice",
      courseId: option.courseId,
      title: `Put ${option.title} into practice`,
      reason: option.practiceReason,
      why: "You completed this course. Beckett is not inferring anything beyond that choice.",
      href: option.practiceHref,
      actionLabel: option.practiceLabel,
      secondaryHref: option.href,
      secondaryLabel: "Review the skill",
      evidence,
    };
  }

  return null;
}
