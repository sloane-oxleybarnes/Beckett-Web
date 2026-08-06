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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event) => {
    const profile = await resolveWorkspaceAddOnProfile(event);
    if (!profile) return triggerCardResponse(signInCard(request));
    if (!isWorkspaceAddOnPlanEligible(profile.plan)) {
      return triggerCardResponse({
        header: beckettCardHeader("Beckett", "Plan required"),
        sections: [{ widgets: [textWidget("Your Beckett plan does not currently include Gmail analysis.")] }],
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
