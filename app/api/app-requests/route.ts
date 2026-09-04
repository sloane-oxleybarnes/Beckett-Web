import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { platformRepository } from "@/lib/repositories/platform-repository";
import { trackBetaEvent } from "@/lib/beta-events";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as { appName?: unknown; useCase?: unknown } | null;
  const appName = typeof body?.appName === "string" ? body.appName.trim() : "";
  const useCase = typeof body?.useCase === "string" ? body.useCase.trim() : "";
  if (!appName || appName.length > 120 || useCase.length > 1000) {
    return NextResponse.json({ error: "Add an app name and keep the request under 1,000 characters." }, { status: 400 });
  }

  const { error } = await platformRepository.from("beta_feedback").insert({
    user_id: user.id,
    rating: "yes",
    comment: useCase || `Requested an integration or browser extension for ${appName}.`,
    platform: "web",
    mode: "/dashboard/apps",
    source: "app_extension_request",
    response_text: null,
    analysis_result: {},
    context_snapshot: {},
    metadata: { requested_app: appName },
  });
  if (error) return NextResponse.json({ error: "Could not save your request. Please try again." }, { status: 500 });

  await trackBetaEvent({
    userId: user.id,
    email: user.email,
    eventName: "app_extension_requested",
    source: "apps_page",
    metadata: { requestedApp: appName },
  });

  return NextResponse.json({ ok: true });
}
