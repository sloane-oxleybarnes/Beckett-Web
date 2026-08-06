import { NextRequest } from "next/server";
import { trackBetaEvent } from "@/lib/beta-events";
import {
  beckettCardHeader,
  buttonWidget,
  cardUpdateResponse,
  endpointUrl,
  resolveWorkspaceAddOnProfile,
  signInCard,
  textWidget,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";
import { supabaseAdmin } from "@/lib/server-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event) => {
    const profile = await resolveWorkspaceAddOnProfile(event);
    if (!profile) return cardUpdateResponse(signInCard(request));

    const enabled = event.commonEventObject?.parameters?.enabled === "true";
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ pattern_model_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) throw error;

    await trackBetaEvent({
      userId: profile.id,
      email: profile.email,
      eventName: "email_style_learning_updated",
      source: "google_workspace_addon",
      metadata: { enabled },
    });

    return cardUpdateResponse(
      {
        header: beckettCardHeader("Beckett", "Email style learning"),
        sections: [
          {
            widgets: [
              textWidget(
                enabled
                  ? "Style learning is on. Beckett will save compact writing patterns only from Gmail conversations you choose to analyze."
                  : "Style learning is off. Beckett will stop saving new Gmail writing-style patterns.",
              ),
              buttonWidget(
                enabled ? "Turn off style learning" : "Turn on style learning",
                endpointUrl(request, "/api/google-workspace-addon/style-memory"),
                { enabled: enabled ? "false" : "true" },
              ),
            ],
          },
        ],
      },
      true,
    );
  });
}
