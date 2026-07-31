import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/server-admin";
import { createOrUpdateHubSpotContact } from "@/lib/hubspot";
import { triggerLoopsEvent } from "@/lib/loops";
import { enforceRateLimit, hashRateLimitKey, rateLimitResponse, readJsonWithLimit } from "@/lib/security-rate-limit";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = enforceRateLimit(`upgrade:${hashRateLimitKey(user.id)}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: rateLimitResponse(limit) });

  const body = await readJsonWithLimit<{ target_plan?: unknown }>(request, 2_000);
  if (body?.target_plan !== "pro") return NextResponse.json({ error: "Unsupported plan." }, { status: 400 });

  const email = user.email.trim().toLowerCase();
  const { error } = await supabaseAdmin.from("upgrade_intents").insert({
    user_id: user.id,
    email,
    target_plan: "pro",
  });
  if (error) return NextResponse.json({ error: "Could not save your request." }, { status: 500 });

  await Promise.all([
    createOrUpdateHubSpotContact({
      email,
      plan: "pro",
      source: "upgrade_intent",
      properties: { beckett_beta_status: "upgrade_intent" },
    }),
    triggerLoopsEvent(email, "upgrade_intent", { plan: "pro" }),
  ]);

  return NextResponse.json({ ok: true });
}
