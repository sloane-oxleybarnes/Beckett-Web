import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/server-auth";
import { linkSlackUser } from "@/lib/slack-installation";
import { verifySlackState } from "@/lib/slack-signed-state";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const state = verifySlackState(token, "account_link");
  if (!state?.teamId || !state.slackUserId) return NextResponse.redirect(new URL("/slack/installed?error=link", req.url));
  const { user } = await getAuthenticatedContext();
  if (!user) {
    const next = `/api/slack/account-link?token=${encodeURIComponent(token)}`;
    return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(next)}`, req.url));
  }
  await linkSlackUser({ teamId: state.teamId, slackUserId: state.slackUserId, beckettUserId: user.id });
  return NextResponse.redirect(new URL("/slack/installed?linked=true", req.url));
}
