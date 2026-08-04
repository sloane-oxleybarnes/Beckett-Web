import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listMicrosoftCalendars, microsoftNeedsReconnect } from "@/lib/microsoft-oauth";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const calendars = await listMicrosoftCalendars(user.id);
    if (!calendars) return NextResponse.json({ error: "microsoft_not_connected" }, { status: 404 });
    const { data: integration } = await supabaseAdmin
      .from("user_integrations")
      .select("metadata")
      .eq("user_id", user.id)
      .eq("provider", "microsoft")
      .maybeSingle();
    const metadata = integration?.metadata && typeof integration.metadata === "object" ? integration.metadata as Record<string, unknown> : {};
    const availableCalendars = calendars.value || [];
    const storedIds = Array.isArray(metadata.selected_calendar_ids)
      ? metadata.selected_calendar_ids.filter((value): value is string => typeof value === "string")
      : null;
    return NextResponse.json({
      calendars: availableCalendars,
      selectedCalendarIds: storedIds || availableCalendars.map((calendar) => typeof calendar.id === "string" ? calendar.id : "").filter(Boolean),
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Microsoft calendar request failed";
    const reconnect = microsoftNeedsReconnect(caught);
    return NextResponse.json({ error: message, code: reconnect ? "microsoft_reconnect_required" : "microsoft_calendar_unavailable" }, { status: reconnect ? 403 : 502 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { calendarIds?: unknown };
  const requestedIds = Array.isArray(body.calendarIds)
    ? body.calendarIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 50)
    : [];
  if (!requestedIds.length) return NextResponse.json({ error: "Select at least one calendar." }, { status: 400 });

  try {
    const calendars = await listMicrosoftCalendars(user.id);
    if (!calendars) return NextResponse.json({ error: "microsoft_not_connected" }, { status: 404 });
    const validIds = new Set((calendars.value || []).map((calendar) => typeof calendar.id === "string" ? calendar.id : "").filter(Boolean));
    const selectedCalendarIds = requestedIds.filter((id) => validIds.has(id));
    if (!selectedCalendarIds.length) return NextResponse.json({ error: "No selected calendars are available." }, { status: 400 });

    const { data: integration, error: readError } = await supabaseAdmin
      .from("user_integrations")
      .select("metadata")
      .eq("user_id", user.id)
      .eq("provider", "microsoft")
      .maybeSingle();
    if (readError) throw readError;
    const metadata = integration?.metadata && typeof integration.metadata === "object" ? integration.metadata as Record<string, unknown> : {};
    const { error } = await supabaseAdmin
      .from("user_integrations")
      .update({ metadata: { ...metadata, selected_calendar_ids: selectedCalendarIds }, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("provider", "microsoft");
    if (error) throw error;
    return NextResponse.json({ selectedCalendarIds });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Microsoft calendar selection failed";
    const reconnect = microsoftNeedsReconnect(caught);
    return NextResponse.json({ error: message, code: reconnect ? "microsoft_reconnect_required" : "microsoft_calendar_unavailable" }, { status: reconnect ? 403 : 502 });
  }
}
