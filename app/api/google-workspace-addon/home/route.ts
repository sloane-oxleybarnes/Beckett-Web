import { NextRequest } from "next/server";
import {
  cardResponse,
  endpointUrl,
  isWorkspaceAddOnPlanEligible,
  openLinkButtonWidget,
  resolveWorkspaceAddOnProfile,
  signInCard,
  textWidget,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event) => {
    const profile = await resolveWorkspaceAddOnProfile(event);
    if (!profile) return cardResponse(signInCard(request));
    if (!isWorkspaceAddOnPlanEligible(profile.plan)) {
      return cardResponse({
        header: { title: "Beckett", subtitle: "Plan required" },
        sections: [{ widgets: [textWidget("Your Beckett plan does not currently include Gmail analysis."), openLinkButtonWidget("View Beckett", endpointUrl(request, "/dashboard"))] }],
      });
    }
    return cardResponse({
      header: { title: "Beckett for Gmail", subtitle: profile.email || "Connected" },
      sections: [
        {
          header: "Private message support",
          widgets: [
            textWidget("Open an email, then select Beckett to analyze that conversation."),
            textWidget("Beckett reads only the message or thread you explicitly choose. It never sends email for you."),
          ],
        },
        { widgets: [openLinkButtonWidget("Open Beckett settings", endpointUrl(request, "/dashboard/settings"))] },
      ],
    });
  });
}
