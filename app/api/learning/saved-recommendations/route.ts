import { NextRequest, NextResponse } from "next/server";
import { learningRepository } from "@/lib/repositories/learning-repository";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data, error } = await learningRepository
    .from("learning_recommendation_feedback")
    .select("recommendation_key, title, href, reason, evidence, updated_at")
    .eq("user_id", user.id)
    .eq("status", "saved")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load saved suggestions." }, { status: 500 });
  return NextResponse.json({ recommendations: data || [] });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key.length > 120) return NextResponse.json({ error: "Invalid saved suggestion." }, { status: 400 });
  const { error } = await learningRepository
    .from("learning_recommendation_feedback")
    .delete()
    .eq("user_id", user.id)
    .eq("recommendation_key", key)
    .eq("status", "saved");
  if (error) return NextResponse.json({ error: "Could not remove saved suggestion." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
