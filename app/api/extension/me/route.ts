import { NextRequest, NextResponse } from "next/server";
import { getExtensionProfile } from "@/lib/extension-auth";
import { supabaseAdmin } from "@/lib/server-admin";

export async function GET(req: NextRequest) {
  const authProfile = await getExtensionProfile(req);
  if (!authProfile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, full_name, first_name, display_name, plan, strengths, workplace_triggers, communication_preferences, coaching_tone, neurodivergent_context, neurodivergent_context_other"
    )
    .eq("id", authProfile.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const { data: integrations } = await supabaseAdmin
    .from("user_integrations")
    .select("provider, external_user_id, external_team_id, external_team_name, connected_at, updated_at")
    .eq("user_id", authProfile.id);

  const slack = integrations?.find((item) => item.provider === "slack");
  const google = integrations?.find((item) => item.provider === "google");

  const { data: toolkitItems } = await supabaseAdmin
    .from("course_toolkit_items")
    .select("id, course_id, category, label, content, updated_at")
    .eq("user_id", authProfile.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(8);

  return NextResponse.json({
    id: profile.id,
    email: profile.email || null,
    name: profile.display_name || profile.first_name || profile.full_name || null,
    fullName: profile.full_name || null,
    plan: profile.plan || authProfile.plan || "beta",
    coachingProfile: {
      strengths: Array.isArray(profile.strengths) ? profile.strengths : [],
      workplaceTriggers: Array.isArray(profile.workplace_triggers) ? profile.workplace_triggers : [],
      communicationPreferences: Array.isArray(profile.communication_preferences)
        ? profile.communication_preferences
        : [],
      coachingTone: profile.coaching_tone || null,
      neurodivergentContext: Array.isArray(profile.neurodivergent_context)
        ? profile.neurodivergent_context
        : [],
      neurodivergentContextOther: profile.neurodivergent_context_other || null,
    },
    toolkitItems: toolkitItems || [],
    integrations: {
      slack: slack
        ? {
            connected: true,
            userId: slack.external_user_id || null,
            teamId: slack.external_team_id || null,
            teamName: slack.external_team_name || null,
            connectedAt: slack.connected_at || null,
            updatedAt: slack.updated_at || null,
          }
        : { connected: false },
      google: google
        ? {
            connected: true,
            connectedAt: google.connected_at || null,
            updatedAt: google.updated_at || null,
          }
        : { connected: false },
    },
  });
}
