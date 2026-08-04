import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createMicrosoftDraft } from "@/lib/microsoft-oauth";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { confirm?: unknown; subject?: unknown; content?: unknown; to?: unknown };
  if (body.confirm !== true) return NextResponse.json({ error: "Explicit confirmation is required before saving an Outlook draft." }, { status: 400 });
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 500) : "";
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 18_000) : "";
  const to = Array.isArray(body.to) ? body.to.filter((value): value is string => typeof value === "string" && value.includes("@")).slice(0, 20) : [];
  if (!subject || !content) return NextResponse.json({ error: "Subject and draft content are required." }, { status: 400 });
  const { data: integration } = await supabaseAdmin.from("user_integrations").select("metadata").eq("user_id", user.id).eq("provider", "microsoft").maybeSingle();
  const metadata = integration?.metadata && typeof integration.metadata === "object" ? integration.metadata as Record<string, unknown> : {};
  if (!String(metadata.scopes || "").split(" ").includes("Mail.ReadWrite")) return NextResponse.json({ error: "microsoft_mail_write_consent_required" }, { status: 403 });
  try {
    const draft = await createMicrosoftDraft(user.id, { subject, body: content, to });
    return NextResponse.json({ draftId: draft?.id || null });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Could not save Outlook draft" }, { status: 502 });
  }
}
