import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftProfile } from "@/lib/microsoft-oauth";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

function bearerToken(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

export async function POST(request: NextRequest) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Microsoft sign-in is required." }, { status: 401 });

  try {
    const profile = await getMicrosoftProfile(token);
    if (!profile.id) return NextResponse.json({ error: "Microsoft could not identify this account." }, { status: 401 });
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("outlook_sso_link_attempts").upsert({
      id,
      microsoft_user_id: profile.id,
      user_id: null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "microsoft_user_id" });
    if (error) throw error;
    const url = new URL("/api/outlook-link/claim", request.url);
    url.searchParams.set("attempt", id);
    return NextResponse.json({ attempt: id, url: url.toString() });
  } catch {
    return NextResponse.json({ error: "Beckett could not start the account-linking step." }, { status: 502 });
  }
}
