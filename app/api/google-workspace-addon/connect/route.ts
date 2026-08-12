import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/structured-logger";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { connectWorkspaceAddOnAccount } from "@/lib/google-workspace-addon-link";
import { trackBetaEvent } from "@/lib/beta-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  const body = await request.json().catch(() => null) as { token?: string } | null;
  if (!body?.token) return NextResponse.json({ error: "link_expired" }, { status: 400 });

  try {
    const result = await connectWorkspaceAddOnAccount({ token: body.token, userId: user.id });
    if (!result.ok) {
      const status = result.error === "google_account_already_linked" ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    await trackBetaEvent({
      userId: user.id,
      email: user.email,
      eventName: "google_workspace_addon_connected",
      source: "google_workspace_addon",
      metadata: { googleEmailMatchesBeckett: result.googleEmail === user.email?.toLowerCase() },
    });

    return NextResponse.json({ ok: true, googleEmail: result.googleEmail });
  } catch (error) {
    logError("google_workspace.account_link_failed", error, { provider: "gmail", operation: "account_link" });
    return NextResponse.json({ error: "link_failed" }, { status: 500 });
  }
}
