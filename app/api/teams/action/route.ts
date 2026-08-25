import { NextRequest, NextResponse } from "next/server";
import { decryptTeamsActionToken } from "@/lib/teams-action-token";
import { lookupTeamsBeckettUser } from "@/features/teams/user";
import { runTeamsMessageCoaching } from "@/features/teams/coaching";
import { WebCreditLimitError } from "@/lib/web-credits";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  if (typeof body?.token !== "string" || body.token.length > 16_000) {
    return noStoreJson({ error: "invalid_action" }, 400);
  }

  try {
    const action = decryptTeamsActionToken(body.token);
    const configuredTenant = process.env.MICROSOFT_TEAMS_TENANT_ID?.trim();
    if (!configuredTenant || !action.tenantId || action.tenantId !== configuredTenant) {
      return noStoreJson({ error: "teams_tenant_not_allowed" }, 403);
    }
    const user = await lookupTeamsBeckettUser(action.aadObjectId);
    if (!user) {
      return noStoreJson({
        error: "microsoft_account_not_connected",
        message: "Connect this Microsoft account to Beckett before using the Teams action.",
        connectUrl: "/dashboard/apps",
      }, 403);
    }
    const result = await runTeamsMessageCoaching({
      userId: user.id,
      requestId: action.requestId,
      intent: action.intent,
      messageText: action.messageText,
      profileContext: user.promptContext,
    });
    return noStoreJson({ result }, 200);
  } catch (error) {
    if (error instanceof WebCreditLimitError) {
      return noStoreJson({ error: "credit_limit", message: error.message }, 429);
    }
    const message = error instanceof Error && /expired/i.test(error.message)
      ? "This Teams action expired. Close Beckett and run the message action again."
      : "Beckett could not coach this message. Please try again.";
    return noStoreJson({ error: "teams_action_failed", message }, 400);
  }
}
