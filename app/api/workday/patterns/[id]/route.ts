import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const statuses = ["proposed", "remembered", "dismissed", "blocked"] as const;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (!body || !statuses.includes(body.status as (typeof statuses)[number])) {
    return NextResponse.json({ error: "Choose a pattern preference." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("workday_pattern_summaries")
    .update({ status: body.status, acknowledged_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "That pattern is no longer available." }, { status: 404 });
  return NextResponse.json({ pattern: data });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("workday_pattern_summaries")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "That observation could not be deleted." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
