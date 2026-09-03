import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listMicrosoftCalendarEvents, microsoftNeedsReconnect } from "@/lib/microsoft-oauth";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data: integration, error } = await integrationsRepository
    .from("user_integrations")
    .select("metadata")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not read Microsoft Calendar settings." }, { status: 500 });
  if (!integration) return NextResponse.json({ connected: false, events: [] });

  const defaultStart = new Date();
  defaultStart.setHours(0, 0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultEnd.getDate() + 7);
  const requestedStart = request.nextUrl.searchParams.get("from");
  const requestedEnd = request.nextUrl.searchParams.get("to");
  const start = requestedStart ? new Date(requestedStart) : defaultStart;
  const end = requestedEnd ? new Date(requestedEnd) : defaultEnd;
  const validRange = !Number.isNaN(start.getTime())
    && !Number.isNaN(end.getTime())
    && end > start
    && end.getTime() - start.getTime() <= 14 * 24 * 60 * 60 * 1000;
  if (!validRange) return NextResponse.json({ error: "Choose a valid date range of 14 days or less." }, { status: 400 });
  const metadata = integration.metadata && typeof integration.metadata === "object"
    ? integration.metadata as { selectedCalendarIds?: unknown }
    : {};
  const calendarIds = Array.isArray(metadata.selectedCalendarIds)
    ? metadata.selectedCalendarIds.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 10)
    : [];

  try {
    const events = await listMicrosoftCalendarEvents(user.id, calendarIds, start.toISOString(), end.toISOString());
    return NextResponse.json({ connected: true, events: events || [] });
  } catch (caught) {
    if (microsoftNeedsReconnect(caught)) return NextResponse.json({ connected: true, reauthorize: true, events: [] });
    return NextResponse.json({ error: "Microsoft Calendar could not load your events." }, { status: 502 });
  }
}
