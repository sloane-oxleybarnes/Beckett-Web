import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

function destination(request: NextRequest, state: "linked" | "expired" | "error") {
  return new URL(`/dashboard/settings?outlook_link=${state}#connected-accounts`, request.url);
}

export async function GET(request: NextRequest) {
  const attempt = request.nextUrl.searchParams.get("attempt") || "";
  if (!attempt) return NextResponse.redirect(destination(request, "error"));

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}?attempt=${encodeURIComponent(attempt)}`);
    return NextResponse.redirect(login);
  }

  const { data: link, error } = await supabaseAdmin
    .from("outlook_sso_link_attempts")
    .select("microsoft_user_id, expires_at, user_id")
    .eq("id", attempt)
    .maybeSingle();
  if (error || !link || Date.parse(link.expires_at) < Date.now()) return NextResponse.redirect(destination(request, "expired"));
  if (link.user_id && link.user_id !== user.id) return NextResponse.redirect(destination(request, "error"));

  const { data: owner, error: ownerError } = await supabaseAdmin
    .from("user_integrations")
    .select("user_id")
    .eq("provider", "microsoft")
    .eq("external_user_id", link.microsoft_user_id)
    .maybeSingle();
  if (ownerError || (owner?.user_id && owner.user_id !== user.id)) return NextResponse.redirect(destination(request, "error"));

  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("user_integrations")
    .select("external_user_id")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .maybeSingle();
  // Never replace an existing Microsoft connection or its encrypted tokens.
  // The Outlook identity has to be the same account in that case.
  if (existingError || (existing?.external_user_id && existing.external_user_id !== link.microsoft_user_id)) {
    return NextResponse.redirect(destination(request, "error"));
  }
  if (!existing) {
    const { error: integrationError } = await supabaseAdmin.from("user_integrations").insert({
      user_id: user.id,
      provider: "microsoft",
      access_token: null,
      external_user_id: link.microsoft_user_id,
      external_team_id: null,
      external_team_name: null,
      metadata: { provider: "microsoft", outlook_sso_linked_at: now },
      connected_at: now,
      updated_at: now,
    });
    if (integrationError) return NextResponse.redirect(destination(request, "error"));
  }

  await supabaseAdmin.from("outlook_sso_link_attempts").update({ user_id: user.id, updated_at: now }).eq("id", attempt);
  return NextResponse.redirect(destination(request, "linked"));
}
