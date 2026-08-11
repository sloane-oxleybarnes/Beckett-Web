import { NextRequest } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError } from "@/lib/ai-usage";
import { withAiMetering } from "@/lib/ai-metering";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { trackBetaEvent } from "@/lib/beta-events";
import { WebCreditLimitError } from "@/lib/web-credits";
import {
  brandedSectionHeader,
  buttonWidget,
  cardUpdateResponse,
  cardResponse,
  endpointUrl,
  errorCard,
  formSubmitButtonWidget,
  formatCardRichText,
  isWorkspaceAddOnPlanEligible,
  parseLabeledSections,
  resolveWorkspaceAddOnProfile,
  signInCard,
  textInputWidget,
  textWidget,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";
import { getSelectedGmailThread, threadForPrompt } from "@/lib/google-workspace-gmail";
import { loadWorkspaceGmailPersonalization } from "@/lib/google-workspace-personalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event) => {
    const profile = await resolveWorkspaceAddOnProfile(event);
    if (!profile) return cardResponse(await signInCard(request, event));
    if (!isWorkspaceAddOnPlanEligible(profile.plan)) {
      return cardResponse(errorCard("Plan required", "Your Beckett plan does not currently include Gmail reply coaching."));
    }

    const refinement =
      event.commonEventObject?.formInputs?.replyRefinement?.stringInputs?.value?.[0]?.trim().slice(0, 1_000) || "";

    try {
      const thread = await getSelectedGmailThread(event);
      const latest = thread.messages[thread.messages.length - 1];
      if (!latest?.body) return cardResponse(errorCard("Message unavailable", "Gmail did not provide readable message content."));
      const personalization = await loadWorkspaceGmailPersonalization(profile, thread);

      const action = refinement ? "refine_reply" : "draft_reply";
      const result = await withAiMetering({
        userId: profile.id,
        source: "google_workspace_addon",
        action,
        metadata: { platform: "gmail", messageCount: thread.messages.length, refined: Boolean(refinement) },
      }, () => callAnthropic(
        [
          "You are Beckett, a private communication coach.",
          "Messages labeled You were written by the signed-in Beckett user. Refer to that person only as you or your, never by name or in the third person. Never address the Beckett user as the recipient of a suggested reply.",
          "If the newest message is labeled You, draft a follow-up to the other participant rather than a response to the user's own message.",
          "Use the user's messages labeled You as live style examples. Preserve their natural formality, directness, sentence length, and warmth unless their requested refinement asks for a change.",
          `Draft three possible replies to the user-selected Gmail conversation${refinement ? " that incorporate the user's requested additions" : ""}.`,
          "The first should be direct and clear. The second should be warm and collaborative. The third should set a gentle limit.",
          "Preserve the user's agency, avoid inventing facts, and do not imply that Beckett sent or will send anything.",
          "Do not summarize or analyze the conversation, and do not include a preface.",
          "Return exactly three sections named Direct and clear, Warm and collaborative, and Sets a gentle limit.",
          "Begin immediately with Direct and clear.",
          "Use those section names as plain-text headings on their own lines. Do not use Markdown, hashtags, asterisks, or separator lines.",
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
              `Subject: ${latest.subject}`,
              `Selected conversation:\n\n${threadForPrompt(thread, profile.googleEmail)}`,
              ...(refinement ? [`User-requested details to include:\n${refinement}`] : []),
            ].filter(Boolean).join("\n\n"),
          },
        ],
        850,
      ));

      await trackBetaEvent({
        userId: profile.id,
        email: profile.email,
        eventName: refinement ? "reply_refined" : "reply_drafted",
        source: "google_workspace_addon",
        metadata: {
          platform: "gmail",
          action: refinement ? "refine_reply" : "draft_reply",
          messageCount: thread.messages.length,
          coachingProfileIncluded: Boolean(personalization.coachingPromptContext),
          contactContextIncluded: Boolean(personalization.relationshipContext),
        },
      });

      const sections = parseLabeledSections(result, [
        { key: "direct", label: "Direct and clear" },
        { key: "warm", label: "Warm and collaborative" },
        { key: "boundary", label: "Sets a gentle limit" },
      ]);

      const replyCard = {
        name: "beckett-reply-ideas",
        sections: [
            {
              header: brandedSectionHeader("Direct and clear"),
              widgets: [
                textWidget(formatCardRichText(sections.direct || result), 10),
                buttonWidget("Use in Gmail draft", endpointUrl(request, "/api/google-workspace-addon/draft"), {
                  reply: sections.direct || result,
                }),
              ],
            },
            {
              header: brandedSectionHeader("Warm and collaborative"),
              widgets: [
                textWidget(formatCardRichText(sections.warm || "Adapt the direct version with a warmer opening and close."), 10),
                buttonWidget("Use in Gmail draft", endpointUrl(request, "/api/google-workspace-addon/draft"), {
                  reply: sections.warm || "Adapt the direct version with a warmer opening and close.",
                }),
              ],
            },
            {
              header: brandedSectionHeader("Sets a gentle limit"),
              widgets: [
                textWidget(formatCardRichText(sections.boundary || "State what you can do and offer a realistic next step."), 10),
                buttonWidget("Use in Gmail draft", endpointUrl(request, "/api/google-workspace-addon/draft"), {
                  reply: sections.boundary || "State what you can do and offer a realistic next step.",
                }),
              ],
            },
            {
              header: brandedSectionHeader("Want to adjust these?"),
              widgets: [
                textInputWidget(
                  "replyRefinement",
                  "Add anything you want the replies to include",
                  "For example: Mention that I’m unavailable Friday and suggest Tuesday afternoon instead.",
                ),
                formSubmitButtonWidget(
                  "Update responses",
                  endpointUrl(request, "/api/google-workspace-addon/reply"),
                  ["replyRefinement"],
                ),
              ],
            },
        ],
      };

      return refinement ? cardUpdateResponse(replyCard, true) : cardResponse(replyCard, true);
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
