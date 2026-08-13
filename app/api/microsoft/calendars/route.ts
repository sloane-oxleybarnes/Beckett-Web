import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listMicrosoftCalendars, microsoftNeedsReconnect } from "@/lib/microsoft-oauth";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";

export const dynamic = "force-dynamic";

type MicrosoftMetadata = { selectedCalendarIds?: unknown; [key: string]: unknown };

async function currentConnection() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  const { data: integration, error } = await integrationsRepository
    .from("user_integrations")
    .select("id, metadata")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .maybeSingle();
  if (error) return { error: NextResponse.json({ error: "Could not read Microsoft Calendar settings." }, { status: 500 }) };
  return { user, integration: integration ? { ...integration, metadata: (integration.metadata || {}) as MicrosoftMetadata } : null };
}

function selectedCalendarIds(metadata?: MicrosoftMetadata) {
  return Array.isArray(metadata?.selectedCalendarIds)
    ? metadata.selectedCalendarIds.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 10)
    : [];
}

export async function GET() {
  const current = await currentConnection();
  if ("error" in current) return current.error;
  if (!current.integration) return NextResponse.json({ connected: false, calendars: [], selectedCalendarIds: [] });
  try {
    const payload = await listMicrosoftCalendars(current.user.id);
    const calendars = (payload?.value || []).filter((calendar) => calendar.id && calendar.name).map((calendar) => ({
      id: calendar.id as string,
      name: calendar.name as string,
      primary: Boolean(calendar.isDefaultCalendar),
    }));
    const selected = selectedCalendarIds(current.integration.metadata);
    return NextResponse.json({
      connected: true,
      calendars,
      selectedCalendarIds: selected.length ? selected : calendars.filter((calendar) => calendar.primary).map((calendar) => calendar.id).slice(0, 1),
    });
  } catch (error) {
    if (microsoftNeedsReconnect(error)) {
      return NextResponse.json({ connected: true, reauthorize: true, calendars: [], selectedCalendarIds: [] });
    }
    return NextResponse.json({ error: "Microsoft Calendar could not load your calendars." }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  const current = await currentConnection();
  if ("error" in current) return current.error;
  if (!current.integration) return NextResponse.json({ error: "Connect Microsoft 365 first." }, { status: 409 });
  const body = (await request.json().catch(() => null)) as { selectedCalendarIds?: unknown } | null;
  const selected = Array.isArray(body?.selectedCalendarIds)
    ? Array.from(new Set(body.selectedCalendarIds.filter((id): id is string => typeof id === "string" && id.length > 0))).slice(0, 10)
    : [];
  if (!selected.length) return NextResponse.json({ error: "Choose at least one calendar." }, { status: 400 });
  const { error } = await integrationsRepository.from("user_integrations").update({
    metadata: { ...current.integration.metadata, selectedCalendarIds: selected },
    updated_at: new Date().toISOString(),
  }).eq("id", current.integration.id);
  if (error) return NextResponse.json({ error: "Could not save Microsoft Calendar choices." }, { status: 500 });
  return NextResponse.json({ selectedCalendarIds: selected });
}
