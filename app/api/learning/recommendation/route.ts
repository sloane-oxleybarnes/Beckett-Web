import { NextResponse } from "next/server";
import { findEarnedLearningRecommendation } from "@/lib/earned-learning-recommendations";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const periodStart = () => new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const [{ data: profile }, { data: sessions }, { data: completions }, { data: progress }] = await Promise.all([
    supabaseAdmin.from("profiles").select("pattern_model_enabled, skill_recommendations_enabled").eq("id", user.id).maybeSingle(),
    supabaseAdmin.from("practice_sessions").select("situation, goal, completed_at").eq("user_id", user.id).eq("status", "completed").gte("completed_at", periodStart()).order("completed_at", { ascending: false }).limit(12),
    supabaseAdmin.from("course_completions").select("course_id").eq("user_id", user.id),
    supabaseAdmin.from("course_progress").select("course_id").eq("user_id", user.id),
  ]);

  if (!profile?.pattern_model_enabled || !profile.skill_recommendations_enabled) {
    return NextResponse.json({ recommendation: null, reason: "learning_disabled" });
  }

  const unavailable = new Set([...(completions || []), ...(progress || [])].map((row) => row.course_id));
  const recommendation = findEarnedLearningRecommendation(sessions || [], unavailable);
  return NextResponse.json({ recommendation, reason: recommendation ? "earned" : "not_enough_signal" });
}
