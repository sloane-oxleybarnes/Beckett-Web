import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isValidPlanDate, workdayPlanDate } from "@/lib/workday-planning";

const MAX_FOCUS_LENGTH = 160;
const MAX_NEXT_STEP_LENGTH = 300;

async function currentUser() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function dateForRequest(value: unknown) {
  return isValidPlanDate(value) ? value : workdayPlanDate();
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const planDate = dateForRequest(request.nextUrl.searchParams.get("date"));
  await supabase.from("workday_day_plans").delete().eq("user_id", user.id).lt("plan_date", planDate);
  const { data, error } = await supabase
    .from("workday_day_plans")
    .select("focus, next_step, plan_date, updated_at")
    .eq("user_id", user.id)
    .eq("plan_date", planDate)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load today's focus." }, { status: 500 });
  return NextResponse.json({ plan: data || null });
}

export async function PUT(request: NextRequest) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { focus?: unknown; next_step?: unknown; plan_date?: unknown } | null;
  const focus = typeof body?.focus === "string" ? body.focus.trim().slice(0, MAX_FOCUS_LENGTH) : "";
  const nextStep = typeof body?.next_step === "string" ? body.next_step.trim().slice(0, MAX_NEXT_STEP_LENGTH) : "";
  if (!focus) return NextResponse.json({ error: "Choose or write a focus for today." }, { status: 400 });
  const { data, error } = await supabase
    .from("workday_day_plans")
    .upsert({ user_id: user.id, plan_date: dateForRequest(body?.plan_date), focus, next_step: nextStep, updated_at: new Date().toISOString() }, { onConflict: "user_id,plan_date" })
    .select("focus, next_step, plan_date, updated_at")
    .single();
  if (error) return NextResponse.json({ error: "Could not save today's focus." }, { status: 500 });
  return NextResponse.json({ plan: data });
}
