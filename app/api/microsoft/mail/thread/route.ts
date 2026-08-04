import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMicrosoftMailMessage } from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const messageId = request.nextUrl.searchParams.get("messageId")?.trim();
  if (!messageId || messageId.length > 500) return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  try {
    const message = await getMicrosoftMailMessage(user.id, messageId);
    if (!message) return NextResponse.json({ error: "microsoft_not_connected" }, { status: 404 });
    return NextResponse.json({ message });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Microsoft message request failed";
    const needsConsent = /permission|insufficient|scope|access denied|forbidden/i.test(message);
    return NextResponse.json({ error: needsConsent ? "microsoft_mail_consent_required" : message }, { status: needsConsent ? 403 : 502 });
  }
}
