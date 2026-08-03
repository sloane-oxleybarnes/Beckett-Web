import { findEarnedLearningRecommendation, type EarnedLearningRecommendation } from "@/lib/earned-learning-recommendations";
import { supabaseAdmin } from "@/lib/server-admin";

const periodStart = () => new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

type RecommendationFeedback = { recommendation_key: string; status: "saved" | "dismissed" };

export type LearningRecommendationResult = {
  recommendation: EarnedLearningRecommendation | null;
  reason: "earned" | "learning_disabled" | "already_decided" | "not_enough_signal";
};

export async function getLearningRecommendationForUser(userId: string): Promise<LearningRecommendationResult> {
  const [{ data: profile }, { data: sessions }, { data: completions }, { data: progress }, { data: supportPlans }, { data: rememberedPatterns }, { data: feedback }] = await Promise.all([
    supabaseAdmin.from("profiles").select("pattern_model_enabled, skill_recommendations_enabled").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("practice_sessions").select("situation, goal, completed_at").eq("user_id", userId).eq("status", "completed").gte("completed_at", periodStart()).order("completed_at", { ascending: false }).limit(12),
    supabaseAdmin.from("course_completions").select("course_id").eq("user_id", userId),
    supabaseAdmin.from("course_progress").select("course_id").eq("user_id", userId),
    supabaseAdmin.from("workday_support_plans").select("cue, support_action").eq("user_id", userId).eq("active", true),
    supabaseAdmin.from("workday_pattern_summaries").select("summary").eq("user_id", userId).eq("active", true).eq("status", "remembered"),
    supabaseAdmin.from("learning_recommendation_feedback").select("recommendation_key, status").eq("user_id", userId),
  ]);

  if (!profile?.pattern_model_enabled || !profile.skill_recommendations_enabled) {
    return { recommendation: null, reason: "learning_disabled" };
  }

  const completedCourseIds = new Set((completions || []).map((row) => row.course_id));
  const unavailableCourseIds = new Set([...(completions || []), ...(progress || [])].map((row) => row.course_id));
  const recommendation = findEarnedLearningRecommendation({
    sessions: sessions || [],
    unavailableCourseIds,
    completedCourseIds,
    savedSupportPlanText: (supportPlans || []).flatMap((plan) => [plan.cue, plan.support_action]),
    rememberedPatternText: (rememberedPatterns || []).map((pattern) => pattern.summary),
  });

  if (!recommendation) return { recommendation: null, reason: "not_enough_signal" };
  if ((feedback as RecommendationFeedback[] | null)?.some((item) => item.recommendation_key === recommendation.key)) {
    return { recommendation: null, reason: "already_decided" };
  }
  return { recommendation, reason: "earned" };
}
