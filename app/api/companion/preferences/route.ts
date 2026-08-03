import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const promptStyles = ["off", "quiet", "direct"] as const;
const retentionPreferences = ["do_not_save", "notes_only", "summary_only"] as const;
const includes = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === "string" && values.includes(value);

async function authedProfile() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await authedProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data, error } = await supabase.from("profiles").select("desktop_companion_enabled, meeting_support_enabled, meeting_prompt_style, meeting_retention_preference, meeting_consent_reminder_enabled").eq("id", user.id).single();
  if (error) return NextResponse.json({ error: "Desktop Companion is not set up yet." }, { status: 503 });
  return NextResponse.json({ preferences: data });
}

export async function PUT(request: NextRequest) {
  const { supabase, user } = await authedProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.desktop_companion_enabled !== "boolean" || typeof body.meeting_support_enabled !== "boolean" ||
    typeof body.meeting_consent_reminder_enabled !== "boolean" || !includes(promptStyles, body.meeting_prompt_style) ||
    !includes(retentionPreferences, body.meeting_retention_preference)) {
    return NextResponse.json({ error: "Invalid Desktop Companion preferences." }, { status: 400 });
  }
  const { data, error } = await supabase.from("profiles").update({
    desktop_companion_enabled: body.desktop_companion_enabled,
    meeting_support_enabled: body.meeting_support_enabled,
    meeting_prompt_style: body.meeting_prompt_style,
    meeting_retention_preference: body.meeting_retention_preference,
    meeting_consent_reminder_enabled: body.meeting_consent_reminder_enabled,
  }).eq("id", user.id).select("desktop_companion_enabled, meeting_support_enabled, meeting_prompt_style, meeting_retention_preference, meeting_consent_reminder_enabled").single();
  if (error) return NextResponse.json({ error: "Could not save Desktop Companion preferences." }, { status: 500 });
  return NextResponse.json({ preferences: data });
}
