import { NextRequest } from "next/server";
import {
  beckettCardHeader,
  buttonWidget,
  endpointUrl,
  isWorkspaceAddOnPlanEligible,
  resolveWorkspaceAddOnProfile,
  signInCard,
  textWidget,
  triggerCardResponse,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";
import { buildWorkspaceAnalysisCard } from "@/lib/google-workspace-analysis-card";
import {
  loadWorkspaceAnalysisCache,
  loadWorkspaceAnalysisCacheByMessageId,
  loadWorkspaceAnalysisCacheByThreadId,
} from "@/lib/google-workspace-analysis-cache";
import { getSelectedGmailThread } from "@/lib/google-workspace-gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event) => {
    const profile = await resolveWorkspaceAddOnProfile(event);
    if (!profile) return triggerCardResponse(await signInCard(request, event));
    if (!isWorkspaceAddOnPlanEligible(profile.plan)) {
      return triggerCardResponse({
        header: beckettCardHeader("Beckett", "Plan required"),
        sections: [{ widgets: [textWidget("Your Beckett plan does not currently include Gmail analysis.")] }],
      });
    }
    const cachedByThread = await loadWorkspaceAnalysisCacheByThreadId({
      userId: profile.id,
      threadId: event.gmail?.threadId || "",
    });
    if (cachedByThread) {
      return triggerCardResponse(buildWorkspaceAnalysisCard(request, cachedByThread));
    }
    const cachedByMessage = await loadWorkspaceAnalysisCacheByMessageId({
      userId: profile.id,
      messageId: event.gmail?.messageId || "",
    });
    if (cachedByMessage) {
      return triggerCardResponse(buildWorkspaceAnalysisCard(request, cachedByMessage));
    }
    try {
      const thread = await getSelectedGmailThread(event);
      const cachedSections = await loadWorkspaceAnalysisCache({ userId: profile.id, thread });
      if (cachedSections) {
        return triggerCardResponse(buildWorkspaceAnalysisCard(request, cachedSections));
      }
    } catch (error) {
      console.error("Google Workspace cached analysis restore failed", {
        userId: profile.id,
        message: error instanceof Error ? error.message : "analysis_restore_failed",
      });
    }
    return triggerCardResponse({
      name: "beckett-selected-message",
      header: beckettCardHeader("Beckett", "Email analysis"),
      sections: [
        {
          widgets: [
            textWidget("Understand what’s happening, the tone, what they want, and how you could reply."),
            buttonWidget("Analyze email", endpointUrl(request, "/api/google-workspace-addon/analyze")),
          ],
        },
      ],
    });
  });
}
