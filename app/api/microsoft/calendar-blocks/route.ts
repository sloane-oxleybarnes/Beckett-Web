import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createMicrosoftCalendarEvent } from "@/lib/microsoft-oauth";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { confirm?: unknown; calendarId?: unknown; subject?: unknown; start?: unknown; end?: unknown; timeZone?: unknown };
  if (body.confirm !== true) return NextResponse.json({ error: "Explicit confirmation is required before changing your calendar." }, { status: 400 });
  const calendarId = typeof body.calendarId === "string" ? body.calendarId : "default";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "Beckett protected break";
  const start = typeof body.start === "string" ? body.start : "";
  const end = typeof body.end === "string" ? body.end : "";
  if (!start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) return NextResponse.json({ error: "Valid start and end times are required." }, { status: 400 });
  const { data: integration } = await supabaseAdmin.from("user_integrations").select("metadata").eq("user_id", user.id).eq("provider", "microsoft").maybeSingle();
  const metadata = integration?.metadata && typeof integration.metadata === "object" ? integration.metadata as Record<string, unknown> : {};
  if (!String(metadata.scopes || "").split(" ").includes("Calendars.ReadWrite")) return NextResponse.json({ error: "microsoft_calendar_write_consent_required" }, { status: 403 });
  try {
    const event = await createMicrosoftCalendarEvent(user.id, calendarId, { subject, start, end, timeZone: typeof body.timeZone === "string" ? body.timeZone : "UTC" });
    return NextResponse.json({ event });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Could not create calendar block" }, { status: 502 });
  }
}
