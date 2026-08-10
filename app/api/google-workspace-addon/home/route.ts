import { NextRequest } from "next/server";
import {
  beckettCardHeader,
  buttonWidget,
  endpointUrl,
  isWorkspaceAddOnPlanEligible,
  openLinkButtonWidget,
  resolveWorkspaceAddOnProfile,
  signInCard,
  textWidget,
  triggerCardResponse,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event, diagnostics) => {
    const profile = await resolveWorkspaceAddOnProfile(event, diagnostics);
    if (!profile) return triggerCardResponse(await signInCard(request, event));
    if (!isWorkspaceAddOnPlanEligible(profile.plan)) {
      return triggerCardResponse({
        header: beckettCardHeader("Beckett", "Plan required"),
        sections: [{ widgets: [textWidget("Your Beckett plan does not currently include Gmail analysis."), openLinkButtonWidget("View Beckett", endpointUrl(request, "/dashboard"))] }],
      });
    }
    return triggerCardResponse({
      header: beckettCardHeader("Beckett", profile.email || "Connected"),
      sections: [
        {
          header: "Private message support",
          widgets: [
            textWidget("Open an email, then select Beckett to analyze that conversation."),
            textWidget("Beckett reads only the message or thread you explicitly choose. It never sends email for you."),
          ],
        },
        {
          header: "Email style learning",
          widgets: [
            textWidget(
              profile.patternModelEnabled
                ? "On — Beckett can remember compact style patterns from emails you explicitly analyze. Full email bodies are not stored for style learning."
                : "Off — Beckett uses the selected thread for the current response but does not remember its writing style afterward.",
            ),
            buttonWidget(
              profile.patternModelEnabled ? "Turn off style learning" : "Turn on style learning",
              endpointUrl(request, "/api/google-workspace-addon/style-memory"),
              { enabled: profile.patternModelEnabled ? "false" : "true" },
            ),
          ],
        },
        { widgets: [openLinkButtonWidget("Open Beckett settings", endpointUrl(request, "/dashboard/settings"))] },
      ],
    });
  });
}
