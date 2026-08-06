import { NextRequest, NextResponse } from "next/server";
import { trackBetaEvent } from "@/lib/beta-events";
import {
  cardResponse,
  errorCard,
  isWorkspaceAddOnPlanEligible,
  resolveWorkspaceAddOnProfile,
  signInCard,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";
import { gmailOpenCreatedDraftAction } from "@/lib/google-workspace-gmail-action";
import { createGmailReplyDraft, getSelectedGmailThread } from "@/lib/google-workspace-gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.addons.current.action.compose";

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event) => {
    const authorizedScopes = event.authorizationEventObject?.authorizedScopes || [];
    if (!authorizedScopes.includes(GMAIL_COMPOSE_SCOPE)) {
      return NextResponse.json({
        requestingGoogleScopes: { scopes: [GMAIL_COMPOSE_SCOPE] },
      });
    }

    const profile = await resolveWorkspaceAddOnProfile(event);
    if (!profile) return cardResponse(signInCard(request));
    if (!isWorkspaceAddOnPlanEligible(profile.plan)) {
      return cardResponse(errorCard("Plan required", "Your Beckett plan does not currently include Gmail reply coaching."));
    }

    const reply = event.commonEventObject?.parameters?.reply?.trim().slice(0, 8_000) || "";
    if (!reply) return cardResponse(errorCard("Reply unavailable", "Beckett could not find the selected reply text."));

    try {
      const thread = await getSelectedGmailThread(event);
      const { draftId, draftThreadId } = await createGmailReplyDraft(event, thread, profile.googleEmail, reply);

      await trackBetaEvent({
        userId: profile.id,
        email: profile.email,
        eventName: "reply_draft_created",
        source: "google_workspace_addon",
        metadata: { platform: "gmail", action: "create_reply_draft", messageCount: thread.messages.length },
      });

      return NextResponse.json(gmailOpenCreatedDraftAction(draftId, draftThreadId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "gmail_draft_failed";
      console.error("Google Workspace Gmail draft creation failed", { message, userId: profile.id });
      const friendly =
        message === "gmail_reply_recipient_missing"
          ? "Beckett could not identify a recipient for this reply."
          : message.startsWith("gmail_draft_api_error:403") || message === "gmail_authorization_missing"
            ? "Reopen Beckett and approve the Gmail draft permission, then try again."
            : "Beckett could not create the Gmail draft. Please reopen the email and try again.";
      return cardResponse(errorCard("Draft unavailable", friendly));
    }
  });
}
