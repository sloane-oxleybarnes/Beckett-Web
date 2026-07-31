import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const outcomes = ["helped", "a_little", "not_helpful", "skipped"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as { outcome?: string; remember_for_learning?: boolean } | null;
  if (!body || !outcomes.includes(body.outcome as (typeof outcomes)[number])) {
    return NextResponse.json({ error: "Choose how the support action felt." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("workday_support_actions")
    .update({ outcome: body.outcome, remember_for_learning: body.remember_for_learning === true, followed_up_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("outcome", null)
    .select("*")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "That support action is no longer available." }, { status: 404 });
  return NextResponse.json({ action: data });
}
