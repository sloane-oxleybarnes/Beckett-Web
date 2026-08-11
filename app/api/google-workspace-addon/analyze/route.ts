import { NextRequest } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError, recordAiUsage } from "@/lib/ai-usage";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { trackBetaEvent } from "@/lib/beta-events";
import { recordSafeInteractionSummary } from "@/lib/contact-relationship-context";
import {
  WEB_CREDITS_ENABLED,
  WebCreditLimitError,
  assertWebCreditsAvailable,
  recordSuccessfulWebCredit,
} from "@/lib/web-credits";
import {
  cardUpdateResponse,
  errorCard,
  isWorkspaceAddOnPlanEligible,
  parseLabeledSections,
  resolveWorkspaceAddOnProfile,
  signInCard,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";
import {
  buildWorkspaceAnalysisCard,
  type WorkspaceAnalysisSections,
} from "@/lib/google-workspace-analysis-card";
import {
  loadWorkspaceAnalysisCache,
  storeWorkspaceAnalysisCache,
} from "@/lib/google-workspace-analysis-cache";
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

function contactCardState(personalization: Awaited<ReturnType<typeof loadWorkspaceGmailPersonalization>>) {
  const counterparts = personalization.counterparts.slice(0, 5);
  if (!counterparts.length) return null;

  if (counterparts.length === 1) {
    if (personalization.relationshipContext) return null;
    const [counterpart] = counterparts;
    return {
      message: `This conversation appears to be with ${counterpart.name} (${counterpart.email}). Add them to Beckett Contacts and save this interaction summary?`,
      choices: [{ email: counterpart.email, label: `Add ${counterpart.name} to Contacts` }],
    };
  }

  return {
    message: "This conversation includes several people. Choose who this interaction should be saved to; Beckett will not assign it automatically.",
    choices: counterparts.map((counterpart) => ({
      email: counterpart.email,
      label: `Save for ${counterpart.name}`,
    })),
  };
}

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event, diagnostics) => {
    const profile = await resolveWorkspaceAddOnProfile(event, diagnostics);
    if (!profile) return cardUpdateResponse(await signInCard(request, event));
    if (!isWorkspaceAddOnPlanEligible(profile.plan)) {
      return cardUpdateResponse(errorCard("Plan required", "Your Beckett plan does not currently include Gmail analysis."));
    }

    try {
      const thread = await getSelectedGmailThread(event);
      const latest = thread.messages[thread.messages.length - 1];
      if (!latest?.body) return cardUpdateResponse(errorCard("Message unavailable", "Gmail did not provide readable message content."));
      const personalization = await loadWorkspaceGmailPersonalization(profile, thread);
      const contacts = contactCardState(personalization);
      const cachedSections = await loadWorkspaceAnalysisCache({ userId: profile.id, thread });
      if (cachedSections) {
        await storeWorkspaceAnalysisCache({ userId: profile.id, thread, sections: cachedSections }).catch((error) => {
          console.error("Google Workspace analysis cache refresh failed", {
            userId: profile.id,
            threadId: thread.id,
            message: error instanceof Error ? error.message : "analysis_cache_refresh_failed",
          });
        });
        return cardUpdateResponse(buildWorkspaceAnalysisCard(request, cachedSections, contacts));
      }

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
          "Messages labeled You were written by the signed-in Beckett user. Always refer to that person as you or your. Never refer to them by name or in the third person.",
          "Do not claim to know a sender's intent as fact. Separate visible evidence from possible interpretations.",
          "Use messages labeled You as live writing-style evidence when describing the user's communication, but do not overgeneralize from one thread.",
          "Return exactly three concise sections named What's happening, Tone, and What they want.",
          "Use those section names as plain-text headings on their own lines. Do not use hashtags, asterisks, or separator lines.",
          "Within each section, write one short bottom-line sentence first, followed by 1-3 brief lines beginning with a hyphen that support it.",
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
      );

      if (WEB_CREDITS_ENABLED) {
        await recordSuccessfulWebCredit(profile.id, {
          source: "google_workspace_addon",
          action: "analyze_message",
          metadata: { platform: "gmail", messageCount: thread.messages.length },
        });
      }

      const parsedSections = parseLabeledSections(result, [
        { key: "happening", label: "What's happening" },
        { key: "tone", label: "Tone" },
        { key: "want", label: "What they want" },
      ]);
      const sections: WorkspaceAnalysisSections = {
        happening: parsedSections.happening || result,
        tone: parsedSections.tone || "The visible wording does not establish a clear emotional tone.",
        want: parsedSections.want || "No explicit next step is visible in the selected conversation.",
      };

      await storeWorkspaceAnalysisCache({ userId: profile.id, thread, sections }).catch((error) => {
        console.error("Google Workspace analysis cache write failed", {
          userId: profile.id,
          threadId: thread.id,
          message: error instanceof Error ? error.message : "analysis_cache_write_failed",
        });
      });

      if (personalization.relationshipContext && personalization.counterparts.length === 1) {
        await recordSafeInteractionSummary({
          userId: profile.id,
          contactId: personalization.relationshipContext.contact.id,
          platform: "gmail",
          interactionType: "selected_thread_analysis",
          summary: sections.happening.slice(0, 2_000),
          toneObserved: sections.tone.slice(0, 1_000) || null,
          suggestedFollowup: sections.want.slice(0, 1_000) || null,
          dedupeKey: gmailInteractionDedupeKey(thread),
          metadata: {
            source: "google_workspace_addon",
            gmail_thread_id: thread.id,
            selected_message_id: thread.selectedMessageId,
            message_count: thread.messages.length,
            counterpart_email: personalization.counterpartEmail,
            subject: latest.subject,
            provenance: "selected_gmail_conversation",
            derived_at: new Date().toISOString(),
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

      return cardUpdateResponse(buildWorkspaceAnalysisCard(request, sections, contacts));
    } catch (error) {
      if (error instanceof AiUsageLimitError) {
        return cardUpdateResponse(errorCard("Daily limit reached", error.message));
      }
      if (error instanceof WebCreditLimitError) {
        return cardUpdateResponse(errorCard("Credit limit reached", error.message));
      }
      const message = error instanceof Error ? error.message : "analysis_failed";
      console.error("Google Workspace Gmail analysis failed", { message, userId: profile.id });
      const friendly = message.startsWith("gmail_api_error:403")
        ? "Google did not grant access to this message. Reopen Beckett and approve the requested Gmail permission."
        : "Beckett could not analyze this conversation. Please reopen the email and try again.";
      return cardUpdateResponse(errorCard("Analysis unavailable", friendly));
    }
  });
}
