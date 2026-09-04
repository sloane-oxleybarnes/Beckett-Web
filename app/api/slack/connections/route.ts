import { NextRequest, NextResponse } from "next/server";
import { trackBetaEvent } from "@/lib/beta-events";
import {
  loadSlackConnectionsForUser,
  removeLegacySlackConnection,
  unlinkModernSlackConnection,
} from "@/lib/slack-connections-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function validSlackId(value: unknown, prefix: "T" | "U") {
  return typeof value === "string" && new RegExp(`^${prefix}[A-Z0-9]{6,}$`, "i").test(value);
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    return NextResponse.json(await loadSlackConnectionsForUser(user.id));
  } catch {
    return NextResponse.json({ error: "Could not load Slack workspaces." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    kind?: unknown;
    teamId?: unknown;
    userId?: unknown;
  } | null;
  if (
    (body?.kind !== "modern" && body?.kind !== "legacy") ||
    !validSlackId(body.teamId, "T") ||
    !validSlackId(body.userId, "U")
  ) {
    return NextResponse.json({ error: "Invalid Slack workspace connection." }, { status: 400 });
  }

  try {
    const changed = body.kind === "modern"
      ? await unlinkModernSlackConnection({
          beckettUserId: user.id,
          teamId: body.teamId as string,
          slackUserId: body.userId as string,
        })
      : await removeLegacySlackConnection({
          beckettUserId: user.id,
          teamId: body.teamId as string,
          slackUserId: body.userId as string,
        });

    if (!changed) return NextResponse.json({ error: "Slack workspace connection not found." }, { status: 404 });

    await trackBetaEvent({
      userId: user.id,
      email: user.email,
      eventName: body.kind === "modern" ? "slack_user_unlinked" : "slack_legacy_connection_removed",
      source: "web_app",
      metadata: { teamId: body.teamId },
    });

    return NextResponse.json({ ok: true, ...(await loadSlackConnectionsForUser(user.id)) });
  } catch {
    return NextResponse.json({ error: "Could not update this Slack workspace connection." }, { status: 500 });
  }
}
