import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server-admin";
import { SITE_CONTENT_FIELDS } from "@/lib/site-content";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const content = body.content as Record<string, unknown> | undefined;
  if (!content) {
    return NextResponse.json({ error: "Missing content." }, { status: 400 });
  }

  const rows = SITE_CONTENT_FIELDS.map((field) => ({
    key: field.key,
    value: String(content[field.key] ?? field.defaultValue),
    label: field.label,
    section: field.group,
    input_type: field.inputType || "text",
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from("site_content")
    .upsert(rows, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
