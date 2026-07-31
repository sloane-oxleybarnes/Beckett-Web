import { NextResponse } from "next/server";
import { getLearningRecommendationForUser } from "@/lib/server-learning-recommendation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await getLearningRecommendationForUser(user.id);
  return NextResponse.json(result);
}
