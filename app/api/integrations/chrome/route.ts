import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function DELETE() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { error } = await supabaseAdmin.from("profiles").update({
    extension_token: null,
    extension_connected_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Could not disconnect the Chrome extension." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
