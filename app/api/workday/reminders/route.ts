import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isReminderKind, isValidReminderTime } from "@/lib/workday-planning";

const days = new Set([0, 1, 2, 3, 4, 5, 6]);

async function getUser() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data, error } = await supabase.from("workday_reminders").select("*").eq("user_id", user.id).order("reminder_time");
  if (error) return NextResponse.json({ error: "Reminders are not set up yet." }, { status: 503 });
  return NextResponse.json({ reminders: data || [] });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { title?: unknown; reminder_time?: unknown; days_of_week?: unknown; reminder_kind?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const reminderTime = isValidReminderTime(body?.reminder_time) ? body.reminder_time : "";
  const selectedDays = Array.isArray(body?.days_of_week) ? Array.from(new Set(body.days_of_week.filter((day): day is number => Number.isInteger(day) && days.has(day)))).sort((a, b) => a - b) : [];
  const reminderKind = body?.reminder_kind === undefined ? "check_in" : body.reminder_kind;
  if (!title || !reminderTime || !selectedDays.length || !isReminderKind(reminderKind)) return NextResponse.json({ error: "Add a title, support type, time, and at least one day." }, { status: 400 });
  const { data, error } = await supabase.from("workday_reminders").insert({ user_id: user.id, title, reminder_time: reminderTime, days_of_week: selectedDays, reminder_kind: reminderKind }).select("*").single();
  if (error) return NextResponse.json({ error: "Could not save the reminder." }, { status: 500 });
  return NextResponse.json({ reminder: data }, { status: 201 });
}
