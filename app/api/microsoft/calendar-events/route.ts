import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listMicrosoftCalendarEvents, microsoftNeedsReconnect } from "@/lib/microsoft-oauth";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

function isoDate(value: string | null, fallback: Date) {
  if (!value) return fallback.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const start = isoDate(request.nextUrl.searchParams.get("start"), new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const end = isoDate(request.nextUrl.searchParams.get("end"), new Date(new Date(start).getTime() + 7 * 24 * 60 * 60 * 1000));

  try {
    const { data: integration } = await supabaseAdmin
      .from("user_integrations")
      .select("metadata")
      .eq("user_id", user.id)
      .eq("provider", "microsoft")
      .maybeSingle();
    const metadata = integration?.metadata && typeof integration.metadata === "object" ? integration.metadata as Record<string, unknown> : {};
    const storedIds = Array.isArray(metadata.selected_calendar_ids)
      ? metadata.selected_calendar_ids.filter((value): value is string => typeof value === "string")
      : [];
    const requestedIds = request.nextUrl.searchParams.getAll("calendarId").filter(Boolean);
    const calendarIds = requestedIds.length ? requestedIds.slice(0, 20) : storedIds.slice(0, 20);
    const events = await listMicrosoftCalendarEvents(user.id, calendarIds, start, end);
    if (!events) return NextResponse.json({ error: "microsoft_not_connected" }, { status: 404 });
    return NextResponse.json({ start, end, events });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Microsoft calendar events request failed";
    const reconnect = microsoftNeedsReconnect(caught);
    return NextResponse.json({ error: message, code: reconnect ? "microsoft_reconnect_required" : "microsoft_calendar_unavailable" }, { status: reconnect ? 403 : 502 });
  }
}
