import { NextRequest } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError } from "@/lib/ai-usage";
import { withAiMetering } from "@/lib/ai-metering";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { trackBetaEvent } from "@/lib/beta-events";
import { recordSafeInteractionSummary } from "@/lib/contact-relationship-context";
import { WebCreditLimitError } from "@/lib/web-credits";
import {
  actionFixedFooter,
  brandedSectionHeader,
  cardResponse,
  endpointUrl,
  errorCard,
  formatCardRichText,
  isWorkspaceAddOnPlanEligible,
  parseLabeledSections,
  resolveWorkspaceAddOnProfile,
  signInCard,
  textWidget,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";
import {
  getSelectedGmailThread,
  gmailInteractionDedupeKey,
  threadForPrompt,
} from "@/lib/google-workspace-gmail";
import { loadWorkspaceGmailPersonalization } from "@/lib/google-workspace-personalization";
import { recordOptInGmailVoicePattern } from "@/lib/google-workspace-voice-pattern";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event) => {
    const profile = await resolveWorkspaceAddOnProfile(event);
    if (!profile) return cardResponse(await signInCard(request, event));
    if (!isWorkspaceAddOnPlanEligible(profile.plan)) {
      return cardResponse(errorCard("Plan required", "Your Beckett plan does not currently include Gmail analysis."));
    }

    try {
      const thread = await getSelectedGmailThread(event);
      const latest = thread.messages[thread.messages.length - 1];
      if (!latest?.body) return cardResponse(errorCard("Message unavailable", "Gmail did not provide readable message content."));
      const personalization = await loadWorkspaceGmailPersonalization(profile, thread);

      const metering = {
        userId: profile.id,
        source: "google_workspace_addon",
        action: "analyze_message",
        metadata: { platform: "gmail", messageCount: thread.messages.length },
      };
      const result = await withAiMetering(metering, () => callAnthropic(
        [
          "You are Beckett, a private communication coach.",
          "Analyze only the user-selected Gmail conversation supplied below.",
          "Messages labeled You were written by the signed-in Beckett user. Always refer to that person as you or your. Never refer to them by name or in the third person.",
          "Do not claim to know a sender's intent as fact. Separate visible evidence from possible interpretations.",
          "Use messages labeled You as live writing-style evidence when describing the user's communication, but do not overgeneralize from one thread.",
          "Return exactly three concise sections named What's happening, Tone, and What they want.",
          "Use those section names as plain-text headings on their own lines. Do not use Markdown, hashtags, asterisks, or separator lines.",
          "What's happening, Tone, and What they want may each use 1-3 short newline-separated bullets.",
          beckettBoundaryPrompt(),
        ].join("\n\n"),
        [
          {
            role: "user",
            content: [
              personalization.coachingPromptContext,
              personalization.relationshipContext?.promptContext
                ? `Confirmed Beckett Contact context:\n${personalization.relationshipContext.promptContext}`
                : "",
              `Subject: ${latest.subject}\nSelected conversation:\n\n${threadForPrompt(thread, profile.googleEmail)}`,
            ].filter(Boolean).join("\n\n"),
          },
        ],
        700,
      ));

      const sections = parseLabeledSections(result, [
        { key: "happening", label: "What's happening" },
        { key: "tone", label: "Tone" },
        { key: "want", label: "What they want" },
      ]);

      if (personalization.relationshipContext) {
        await recordSafeInteractionSummary({
          userId: profile.id,
          contactId: personalization.relationshipContext.contact.id,
          platform: "gmail",
          interactionType: "selected_thread_analysis",
          summary: (sections.happening || result).slice(0, 2_000),
          toneObserved: (sections.tone || "").slice(0, 1_000) || null,
          suggestedFollowup: (sections.want || "").slice(0, 1_000) || null,
          dedupeKey: gmailInteractionDedupeKey(thread),
          metadata: {
            source: "google_workspace_addon",
            gmail_thread_id: thread.id,
            selected_message_id: thread.selectedMessageId,
            message_count: thread.messages.length,
            counterpart_email: personalization.counterpartEmail,
          },
        }).catch((error) => {
          console.error("Google Workspace Gmail interaction summary storage failed", {
            userId: profile.id,
            contactId: personalization.relationshipContext?.contact.id,
            message: error instanceof Error ? error.message : "interaction_summary_failed",
          });
        });
      }

      await recordOptInGmailVoicePattern({
        userId: profile.id,
        userEmail: profile.googleEmail,
        thread,
      }).catch((error) => {
        console.error("Google Workspace Gmail voice pattern storage failed", {
          userId: profile.id,
          message: error instanceof Error ? error.message : "voice_pattern_failed",
        });
      });

      await trackBetaEvent({
        userId: profile.id,
        email: profile.email,
        eventName: "analysis_completed",
        source: "google_workspace_addon",
        metadata: {
          platform: "gmail",
          action: "analyze_message",
          messageCount: thread.messages.length,
          coachingProfileIncluded: Boolean(personalization.coachingPromptContext),
          contactContextIncluded: Boolean(personalization.relationshipContext),
        },
      });

      return cardResponse(
        {
          name: "beckett-analysis-result",
          sections: [
            {
              header: brandedSectionHeader("What's happening"),
              widgets: [textWidget(formatCardRichText(sections.happening || result), 9)],
            },
            {
              header: brandedSectionHeader("Tone"),
              widgets: [textWidget(formatCardRichText(sections.tone || "The visible wording does not establish a clear emotional tone."), 9)],
            },
            {
              header: brandedSectionHeader("What they want"),
              widgets: [textWidget(formatCardRichText(sections.want || "No explicit next step is visible in the selected conversation."), 9)],
            },
          ],
          fixedFooter: actionFixedFooter(
            "Help me reply",
            endpointUrl(request, "/api/google-workspace-addon/reply"),
          ),
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
