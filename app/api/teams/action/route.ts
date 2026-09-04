import { NextRequest, NextResponse } from "next/server";
import { decryptTeamsActionToken, teamsActionRequestId } from "@/lib/teams-action-token";
import { lookupTeamsBeckettUser } from "@/features/teams/user";
import { runTeamsMessageCoaching } from "@/features/teams/coaching";
import { WebCreditLimitError } from "@/lib/web-credits";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: unknown; intent?: unknown } | null;
  if (typeof body?.token !== "string" || body.token.length > 16_000) {
    return noStoreJson({ error: "invalid_action" }, 400);
  }

  let requestId: string | undefined;
  try {
    const action = decryptTeamsActionToken(body.token);
    requestId = action.requestId;
    // A decode dialog may explicitly request editable draft options. The
    // request remains bound to the authenticated, encrypted action token;
    // callers cannot supply a new message or user identity.
    const intent = body.intent === "draft" ? "draft" : action.intent;
    const allowedTenants = (process.env.MICROSOFT_TEAMS_ALLOWED_TENANTS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!action.tenantId || (allowedTenants.length > 0 && !allowedTenants.includes(action.tenantId))) {
      return noStoreJson({ error: "teams_tenant_not_allowed", requestId }, 403);
    }
    const user = await lookupTeamsBeckettUser(action.tenantId, action.aadObjectId);
    if (!user) {
      return noStoreJson({
        error: "microsoft_account_not_connected",
        message: "Connect this Microsoft account to Beckett before using the Teams action.",
        // Start the existing Microsoft 365 OAuth flow directly. The flow
        // returns to the Apps page after sign-in/consent so the user can
        // confirm the connection before retrying this action.
        connectUrl: "/api/microsoft/connect?kind=mail&next=%2Fdashboard%2Fapps",
        requestId,
      }, 403);
    }
    const result = await runTeamsMessageCoaching({
      userId: user.id,
      requestId: teamsActionRequestId(action.activityId, intent),
      intent,
      messageText: action.messageText,
      profileContext: user.promptContext,
    });
    return noStoreJson({ result, requestId }, 200);
  } catch (error) {
    if (error instanceof WebCreditLimitError) {
      return noStoreJson({ error: "credit_limit", message: error.message, retryAt: error.resetsAt }, 429);
    }
    const expired = error instanceof Error && /expired/i.test(error.message);
    const message = expired
      ? "This Teams action expired. Close Beckett and select the message action again for a fresh request."
      : "Beckett could not coach this message right now. Please try again.";
    return noStoreJson({ error: expired ? "teams_action_expired" : "teams_action_failed", message, ...(requestId ? { requestId } : {}) }, 400);
  }
}
