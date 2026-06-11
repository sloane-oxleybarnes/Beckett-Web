import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { trackBetaEvent } from "@/lib/beta-events";

type DashboardFeedbackBody = {
  rating?: "yes" | "no";
  comment?: string;
  page?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

function truncate(value: unknown, max = 4000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as DashboardFeedbackBody;
  if (body.rating !== "yes" && body.rating !== "no") {
    return NextResponse.json({ error: "rating must be yes or no" }, { status: 400 });
  }

  const page = truncate(body.page, 300);
  const source = truncate(body.source || "dashboard", 100) || "dashboard";

  const { error } = await supabaseAdmin.from("beta_feedback").insert({
    user_id: user.id,
    rating: body.rating,
    comment: truncate(body.comment),
    platform: "web",
    mode: page,
    source,
    response_text: null,
    analysis_result: {},
    context_snapshot: {},
    metadata: {
      ...(body.metadata || {}),
      page,
    },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await trackBetaEvent({
    userId: user.id,
    email: user.email,
    eventName: "feedback_submitted",
    source,
    metadata: {
      rating: body.rating,
      page,
    },
  });

  return NextResponse.json({ ok: true });
}
