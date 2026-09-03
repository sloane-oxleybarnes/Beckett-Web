import { NextRequest, NextResponse } from "next/server";
import { learningRepository } from "@/lib/repositories/learning-repository";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const fields = "home_suggestions_enabled, pattern_model_enabled, skill_recommendations_enabled, meeting_prep_learning_enabled";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data, error } = await learningRepository.from("profiles").select(fields).eq("id", user.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Could not load learning preferences." }, { status: 500 });
  return NextResponse.json({ preferences: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid learning preferences." }, { status: 400 });
  const update = Object.fromEntries(
    ["home_suggestions_enabled", "skill_recommendations_enabled", "meeting_prep_learning_enabled"]
      .filter((key) => typeof body[key] === "boolean")
      .map((key) => [key, body[key]])
  );
  if (!Object.keys(update).length) return NextResponse.json({ error: "Choose at least one preference to update." }, { status: 400 });
  const { data, error } = await learningRepository.from("profiles").update({ ...update, updated_at: new Date().toISOString() }).eq("id", user.id).select(fields).single();
  if (error) return NextResponse.json({ error: "Could not save learning preferences." }, { status: 500 });
  return NextResponse.json({ preferences: data });
}
