import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { active?: unknown } | null;
  if (typeof body?.active !== "boolean") return NextResponse.json({ error: "active is required." }, { status: 400 });
  const { data, error } = await supabase.from("workday_reminders").update({ active: body.active, updated_at: new Date().toISOString() }).eq("id", params.id).eq("user_id", user.id).select("*").single();
  if (error) return NextResponse.json({ error: "Could not update the reminder." }, { status: 500 });
  return NextResponse.json({ reminder: data });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { error } = await supabase.from("workday_reminders").delete().eq("id", params.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not delete the reminder." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
