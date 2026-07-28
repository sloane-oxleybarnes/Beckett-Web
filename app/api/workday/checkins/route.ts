import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  breakStatusValues,
  helpfulStrategyValues,
  makePatternSummaries,
  supportActionValues,
  timeOfDayValues,
  workloadValues,
  type WorkdayCheckin,
} from "@/lib/workday-patterns";

const periodStart = () => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
const contains = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === "string" && values.includes(value);

async function currentUser() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const [{ data: checkins, error: checkinsError }, { data: summaries, error: summariesError }, { data: pendingAction, error: pendingActionError }] = await Promise.all([
    supabaseAdmin.from("workday_checkins").select("*").eq("user_id", user.id).gte("checked_in_at", periodStart()).order("checked_in_at", { ascending: false }),
    supabaseAdmin.from("workday_pattern_summaries").select("*").eq("user_id", user.id).eq("active", true).neq("status", "dismissed").order("generated_at", { ascending: false }),
    supabaseAdmin.from("workday_support_actions").select("*").eq("user_id", user.id).is("outcome", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (checkinsError || summariesError || pendingActionError) {
    return NextResponse.json({ error: "Workday coaching is not set up yet. Please try again shortly." }, { status: 503 });
  }
  return NextResponse.json({ checkins: checkins || [], summaries: summaries || [], pendingAction: pendingAction || null });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as (WorkdayCheckin & { support_action?: string }) | null;
  if (!body || !contains(timeOfDayValues, body.time_of_day) || !contains(workloadValues, body.workload_level) ||
    !Number.isInteger(body.energy_level) || body.energy_level < 1 || body.energy_level > 5 ||
    typeof body.communication_friction !== "boolean" || !contains(breakStatusValues, body.break_status) ||
    !contains(helpfulStrategyValues, body.helpful_strategy) || (body.support_action !== undefined && !contains(supportActionValues, body.support_action))) {
    return NextResponse.json({ error: "Please complete each structured check-in field." }, { status: 400 });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin.from("workday_checkins").insert({
    user_id: user.id,
    time_of_day: body.time_of_day,
    workload_level: body.workload_level,
    energy_level: body.energy_level,
    communication_friction: body.communication_friction,
    break_status: body.break_status,
    helpful_strategy: body.helpful_strategy,
  }).select("*").single();
  if (insertError) return NextResponse.json({ error: "Could not save your check-in." }, { status: 500 });

  if (body.support_action) {
    const { error: actionError } = await supabaseAdmin.from("workday_support_actions").insert({
      user_id: user.id,
      checkin_id: inserted.id,
      action_type: body.support_action,
    });
    if (actionError) return NextResponse.json({ error: "Your check-in saved, but the support action could not be recorded." }, { status: 500 });
  }

  const { data: profile } = await supabaseAdmin.from("profiles").select("pattern_model_enabled").eq("id", user.id).maybeSingle();
  let summaries: ReturnType<typeof makePatternSummaries> = [];
  if (profile?.pattern_model_enabled) {
    const { data: recent } = await supabaseAdmin.from("workday_checkins").select("*").eq("user_id", user.id).gte("checked_in_at", periodStart());
    summaries = makePatternSummaries((recent || []) as WorkdayCheckin[]);
    const { data: existing } = await supabaseAdmin.from("workday_pattern_summaries").select("pattern_key, status, acknowledged_at").eq("user_id", user.id);
    await supabaseAdmin.from("workday_pattern_summaries").update({ active: false }).eq("user_id", user.id).eq("status", "proposed");
    if (summaries.length) {
      const existingByKey = new Map((existing || []).map((item) => [item.pattern_key, item]));
      await supabaseAdmin.from("workday_pattern_summaries").upsert(summaries.map((summary) => {
        const prior = existingByKey.get(summary.pattern_key);
        return {
          ...summary,
          user_id: user.id,
          active: true,
          status: prior?.status || "proposed",
          acknowledged_at: prior?.acknowledged_at || null,
          generated_at: new Date().toISOString(),
        };
      }), { onConflict: "user_id,pattern_key" });
    }
  }

  return NextResponse.json({ checkin: inserted, summaries });
}
