import { NextRequest, NextResponse } from "next/server";
import { getLearningRecommendationForUser } from "@/lib/server-learning-recommendation";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type FeedbackAction = "save" | "dismiss";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  const action: FeedbackAction | null = body?.action === "save" || body?.action === "dismiss" ? body.action : null;
  if (!action) return NextResponse.json({ error: "Choose whether to save or dismiss this suggestion." }, { status: 400 });

  const { recommendation } = await getLearningRecommendationForUser(user.id);
  if (!recommendation) return NextResponse.json({ error: "This suggestion is no longer available." }, { status: 409 });

  const { error } = await supabaseAdmin.from("learning_recommendation_feedback").upsert({
    user_id: user.id,
    recommendation_key: recommendation.key,
    status: action === "save" ? "saved" : "dismissed",
    title: recommendation.title,
    href: recommendation.href,
    reason: recommendation.reason,
    evidence: recommendation.evidence,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,recommendation_key" });
  if (error) return NextResponse.json({ error: "Could not save that choice." }, { status: 500 });
  return NextResponse.json({ ok: true, status: action === "save" ? "saved" : "dismissed" });
}
