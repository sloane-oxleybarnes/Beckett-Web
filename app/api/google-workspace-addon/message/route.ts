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
  isExpectedWorkspaceAnalysisCacheSkip,
  workspaceAddOnErrorCode,
  workspaceAddOnLogRecord,
} from "@/lib/google-workspace-addon-diagnostics";
import {
  loadWorkspaceAnalysisCache,
  loadWorkspaceAnalysisCacheByMessageId,
  loadWorkspaceAnalysisCacheByThreadId,
} from "@/lib/google-workspace-analysis-cache";
import { getSelectedGmailThread } from "@/lib/google-workspace-gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event, diagnostics) => {
    const profile = await resolveWorkspaceAddOnProfile(event, diagnostics);
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
      const expectedSkip = isExpectedWorkspaceAnalysisCacheSkip(error);
      const record = workspaceAddOnLogRecord({
        route: diagnostics.route,
        requestId: diagnostics.requestId,
        stage: diagnostics.stage,
        status: 200,
        responseType: "render_action",
        event: expectedSkip ? "analysis_cache_restore_skipped" : "analysis_cache_restore_failed",
        errorCode: workspaceAddOnErrorCode(error),
      });
      if (expectedSkip) {
        console.info("Google Workspace cached analysis restore skipped", record);
      } else {
        console.error("Google Workspace cached analysis restore failed", record);
      }
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
