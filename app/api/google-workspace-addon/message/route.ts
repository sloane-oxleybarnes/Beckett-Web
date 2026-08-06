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
      header: beckettCardHeader("Analyze this conversation", "Nothing is read until you continue"),
      sections: [
        {
          widgets: [
            textWidget("Beckett will securely process the selected Gmail message and available thread context to explain the likely read, what it asks, and a possible next move."),
            buttonWidget("Analyze selected conversation", endpointUrl(request, "/api/google-workspace-addon/analyze")),
          ],
        },
        { widgets: [textWidget("Beckett does not send email and does not claim to know another person's intent as fact.")] },
      ],
    });
  });
}
