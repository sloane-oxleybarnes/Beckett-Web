import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftProfile } from "@/lib/microsoft-oauth";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const attempt = request.nextUrl.searchParams.get("attempt") || "";
  if (!token || !attempt) return NextResponse.json({ error: "Missing account-link request." }, { status: 400 });

  try {
    const profile = await getMicrosoftProfile(token);
    if (!profile.id) return NextResponse.json({ linked: false }, { status: 401 });
    const { data, error } = await supabaseAdmin
      .from("outlook_sso_link_attempts")
      .select("user_id, expires_at")
      .eq("id", attempt)
      .eq("microsoft_user_id", profile.id)
      .maybeSingle();
    if (error || !data || Date.parse(data.expires_at) < Date.now()) return NextResponse.json({ linked: false, expired: true });
    return NextResponse.json({ linked: Boolean(data.user_id) });
  } catch {
    return NextResponse.json({ linked: false }, { status: 401 });
  }
}
