import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { linkSlackUser } from "@/lib/slack-installation";
import { verifySlackState } from "@/lib/slack-signed-state";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const state = verifySlackState(token, "account_link");
  if (!state?.teamId || !state.slackUserId) return NextResponse.redirect(new URL("/slack/installed?error=link", req.url));
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const next = `/api/slack/account-link?token=${encodeURIComponent(token)}`;
    return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(next)}`, req.url));
  }
  await linkSlackUser({ teamId: state.teamId, slackUserId: state.slackUserId, beckettUserId: session.user.id });
  return NextResponse.redirect(new URL("/slack/installed?linked=true", req.url));
}
