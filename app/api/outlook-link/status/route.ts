import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftProfile } from "@/lib/microsoft-oauth";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const attempt = request.nextUrl.searchParams.get("attempt") || "";
  if (!token || !attempt) return NextResponse.json({ error: "Missing account-link request." }, { status: 400 });

  try {
    const profile = await getMicrosoftProfile(token);
    if (!profile.id) return NextResponse.json({ linked: false }, { status: 401 });
    const { data, error } = await integrationsRepository
      .from("outlook_sso_link_attempts")
      .select("user_id, expires_at")
      .eq("id", attempt)
      .eq("microsoft_user_id", profile.id)
      .maybeSingle();
    if (error || !data || Date.parse(data.expires_at) < Date.now()) return NextResponse.json({ linked: false, expired: true });
    if (!data.user_id) return NextResponse.json({ linked: false, mailConnected: false });
    const { data: integration } = await integrationsRepository
      .from("user_integrations")
      .select("metadata")
      .eq("user_id", data.user_id)
      .eq("provider", "microsoft")
      .maybeSingle();
    const scopes = integration?.metadata && typeof integration.metadata === "object" && "scopes" in integration.metadata
      ? String(integration.metadata.scopes || "")
      : "";
    const mailConnected = scopes.split(/\s+/).some((scope) => scope.toLowerCase() === "mail.read");
    return NextResponse.json({ linked: true, mailConnected });
  } catch {
    return NextResponse.json({ linked: false }, { status: 401 });
  }
}
