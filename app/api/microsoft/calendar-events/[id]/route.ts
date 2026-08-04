import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMicrosoftCalendarEvent } from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!params.id || params.id.length > 500) return NextResponse.json({ error: "event id is required" }, { status: 400 });
  try {
    const event = await getMicrosoftCalendarEvent(user.id, params.id, request.nextUrl.searchParams.get("calendarId") || "default");
    if (!event) return NextResponse.json({ error: "microsoft_not_connected" }, { status: 404 });
    return NextResponse.json({ event });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Microsoft event request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
