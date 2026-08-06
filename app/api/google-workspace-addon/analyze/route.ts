import { NextRequest } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError, recordAiUsage } from "@/lib/ai-usage";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { trackBetaEvent } from "@/lib/beta-events";
import {
  WEB_CREDITS_ENABLED,
  WebCreditLimitError,
  assertWebCreditsAvailable,
  recordSuccessfulWebCredit,
} from "@/lib/web-credits";
import {
  cardResponse,
  decoratedTextWidget,
  errorCard,
  formatCardText,
  isWorkspaceAddOnPlanEligible,
  resolveWorkspaceAddOnProfile,
  signInCard,
  textWidget,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";
import { getSelectedGmailThread, threadForPrompt } from "@/lib/google-workspace-gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event) => {
    const profile = await resolveWorkspaceAddOnProfile(event);
    if (!profile) return cardResponse(signInCard(request));
    if (!isWorkspaceAddOnPlanEligible(profile.plan)) {
      return cardResponse(errorCard("Plan required", "Your Beckett plan does not currently include Gmail analysis."));
    }

    try {
      const thread = await getSelectedGmailThread(event);
      const latest = thread.messages[thread.messages.length - 1];
      if (!latest?.body) return cardResponse(errorCard("Message unavailable", "Gmail did not provide readable message content."));

      if (WEB_CREDITS_ENABLED) {
        await assertWebCreditsAvailable(profile.id);
      } else {
        await recordAiUsage(profile.id, {
          source: "google_workspace_addon",
          action: "analyze_message",
          metadata: { platform: "gmail", messageCount: thread.messages.length },
        });
      }

      const result = await callAnthropic(
        [
          "You are Beckett, a private communication coach.",
          "Analyze only the user-selected Gmail conversation supplied below.",
          "Do not claim to know a sender's intent as fact. Separate visible evidence from possible interpretations.",
          "Return concise sections named: Likely read, What it asks, and Possible next move.",
          beckettBoundaryPrompt(),
        ].join("\n\n"),
        [
          {
            role: "user",
            content: `Subject: ${latest.subject}\nSelected conversation:\n\n${threadForPrompt(thread)}`,
          },
        ],
        700,
      );

      if (WEB_CREDITS_ENABLED) {
        await recordSuccessfulWebCredit(profile.id, {
          source: "google_workspace_addon",
          action: "analyze_message",
          metadata: { platform: "gmail", messageCount: thread.messages.length },
        });
      }

      await trackBetaEvent({
        userId: profile.id,
        email: profile.email,
        eventName: "analysis_completed",
        source: "google_workspace_addon",
        metadata: { platform: "gmail", action: "analyze_message", messageCount: thread.messages.length },
      });

      return cardResponse(
        {
          name: "beckett-analysis-result",
          header: { title: "Beckett's read", subtitle: latest.subject.slice(0, 120) },
          sections: [
            {
              widgets: [
                decoratedTextWidget("From", formatCardText(latest.from || "Unknown sender", 500)),
                textWidget(formatCardText(result)),
              ],
            },
            { widgets: [textWidget("Only this user-selected conversation was used for the analysis. No email was sent.")] },
          ],
        },
        true,
      );
    } catch (error) {
      if (error instanceof AiUsageLimitError) {
        return cardResponse(errorCard("Daily limit reached", error.message));
      }
      if (error instanceof WebCreditLimitError) {
        return cardResponse(errorCard("Credit limit reached", error.message));
      }
      const message = error instanceof Error ? error.message : "analysis_failed";
      console.error("Google Workspace Gmail analysis failed", { message, userId: profile.id });
      const friendly = message.startsWith("gmail_api_error:403")
        ? "Google did not grant access to this message. Reopen Beckett and approve the requested Gmail permission."
        : "Beckett could not analyze this conversation. Please reopen the email and try again.";
      return cardResponse(errorCard("Analysis unavailable", friendly));
    }
  });
}
