import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { listMicrosoftMailMessages, microsoftNeedsReconnect } from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await listMicrosoftMailMessages(user.id, request.nextUrl.searchParams.get("search") || undefined, 20);
    if (!result) return NextResponse.json({ error: "microsoft_not_connected" }, { status: 404 });
    return NextResponse.json({ messages: result.value || [] });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Microsoft mail request failed";
    const reconnect = microsoftNeedsReconnect(caught);
    const needsConsent = /permission|insufficient|scope|access denied|forbidden/i.test(message);
    return NextResponse.json({ error: reconnect ? "Microsoft connection needs to be refreshed." : (needsConsent ? "microsoft_mail_consent_required" : message), code: reconnect ? "microsoft_reconnect_required" : (needsConsent ? "microsoft_mail_consent_required" : "microsoft_mail_unavailable") }, { status: reconnect || needsConsent ? 403 : 502 });
  }
}
