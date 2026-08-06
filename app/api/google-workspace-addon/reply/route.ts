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
  beckettCardHeader,
  brandedSectionHeader,
  cardResponse,
  decoratedTextWidget,
  errorCard,
  formatCardRichText,
  formatCardText,
  isWorkspaceAddOnPlanEligible,
  parseLabeledSections,
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
      return cardResponse(errorCard("Plan required", "Your Beckett plan does not currently include Gmail reply coaching."));
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
          action: "draft_reply",
          metadata: { platform: "gmail", messageCount: thread.messages.length },
        });
      }

      const result = await callAnthropic(
        [
          "You are Beckett, a private communication coach.",
          "Draft two possible replies to the user-selected Gmail conversation.",
          "The first should be direct and concise. The second should be warm and collaborative.",
          "Preserve the user's agency, avoid inventing facts, and do not imply that Beckett sent or will send anything.",
          "Return exactly two sections named Direct and concise and Warm and collaborative.",
          "Use those section names as plain-text headings on their own lines. Do not use Markdown, hashtags, asterisks, or separator lines.",
          beckettBoundaryPrompt(),
        ].join("\n\n"),
        [
          {
            role: "user",
            content: `Subject: ${latest.subject}\nSelected conversation:\n\n${threadForPrompt(thread)}`,
          },
        ],
        650,
      );

      if (WEB_CREDITS_ENABLED) {
        await recordSuccessfulWebCredit(profile.id, {
          source: "google_workspace_addon",
          action: "draft_reply",
          metadata: { platform: "gmail", messageCount: thread.messages.length },
        });
      }

      await trackBetaEvent({
        userId: profile.id,
        email: profile.email,
        eventName: "reply_drafted",
        source: "google_workspace_addon",
        metadata: { platform: "gmail", action: "draft_reply", messageCount: thread.messages.length },
      });

      const sections = parseLabeledSections(result, [
        { key: "direct", label: "Direct and concise" },
        { key: "warm", label: "Warm and collaborative" },
      ]);

      return cardResponse(
        {
          name: "beckett-reply-ideas",
          header: beckettCardHeader("Reply ideas", latest.subject.slice(0, 120)),
          sections: [
            {
              widgets: [decoratedTextWidget("Replying to", formatCardText(latest.from || "Unknown sender", 500))],
            },
            {
              header: brandedSectionHeader("Direct and concise"),
              widgets: [textWidget(formatCardRichText(sections.direct || result), 10)],
            },
            {
              header: brandedSectionHeader("Warm and collaborative"),
              widgets: [textWidget(formatCardRichText(sections.warm || "Adapt the direct version with a warmer opening and close."), 10)],
            },
            {
              widgets: [
                decoratedTextWidget(
                  "You stay in control",
                  "Review and personalize any wording before you use it. Beckett has not created or sent a Gmail draft.",
                ),
              ],
            },
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
      const message = error instanceof Error ? error.message : "reply_draft_failed";
      console.error("Google Workspace Gmail reply coaching failed", { message, userId: profile.id });
      const friendly = message.startsWith("gmail_api_error:403")
        ? "Google did not grant access to this message. Reopen Beckett and approve the requested Gmail permission."
        : "Beckett could not prepare reply ideas. Please reopen the email and try again.";
      return cardResponse(errorCard("Reply ideas unavailable", friendly));
    }
  });
}
