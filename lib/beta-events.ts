import { supabaseAdmin } from "./server-admin";
import { createOrUpdateHubSpotContact } from "./hubspot";
import { captureProductEvent } from "./product-analytics";

type BetaEventInput = {
  userId?: string | null;
  email?: string | null;
  eventName: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export async function trackBetaEvent({
  userId = null,
  email = null,
  eventName,
  source = "app",
  metadata = {},
}: BetaEventInput) {
  try {
    const normalizedEmail = email?.trim().toLowerCase() || null;

    await supabaseAdmin.from("beta_events").insert({
      user_id: userId,
      email: normalizedEmail,
      event_name: eventName,
      source,
      metadata,
    });

    await captureProductEvent({
      eventName,
      userId,
      email: normalizedEmail,
      source,
      metadata,
    });

    if (normalizedEmail) {
      await supabaseAdmin
        .from("beta_signups")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("email", normalizedEmail);

      await syncHubSpotBetaEvent({
        email: normalizedEmail,
        userId,
        eventName,
        source,
      });
    }
  } catch (error) {
    console.error("Beta event tracking error:", error);
  }
}

function statusForEvent(eventName: string) {
  if (eventName === "beta_signup_requested") return "requested_access";
  if (eventName === "beta_invite_sent") return "invited";
  if (eventName === "password_set") return "account_created";
  if (eventName === "onboarding_completed") return "onboarded";
  if (
    eventName === "extension_installed" ||
    eventName === "extension_login" ||
    eventName === "gmail_connected" ||
    eventName === "slack_connected" ||
    eventName === "analysis_completed" ||
    eventName === "course_completed" ||
    eventName === "feedback_submitted"
  ) {
    return "active";
  }
  return null;
}

async function countEvents(email: string, eventName: string) {
  const { count } = await supabaseAdmin
    .from("beta_events")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("event_name", eventName);

  return count || 0;
}

async function getFirstEventAt(email: string, eventName: string) {
  const { data } = await supabaseAdmin
    .from("beta_events")
    .select("created_at")
    .eq("email", email)
    .eq("event_name", eventName)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.created_at || null;
}

async function getSignup(email: string) {
  const { data } = await supabaseAdmin
    .from("beta_signups")
    .select("name, source, plan, lifecycle_stage, approved_at, invite_sent_at")
    .eq("email", email)
    .maybeSingle();

  return data;
}

async function syncHubSpotBetaEvent({
  email,
  userId,
  eventName,
  source,
}: {
  email: string;
  userId: string | null;
  eventName: string;
  source: string;
}) {
  try {
    const now = new Date().toISOString();
    const [signup, analysisCount, courseCount, feedbackCount, firstAnalysisAt] = await Promise.all([
      getSignup(email),
      countEvents(email, "analysis_completed"),
      countEvents(email, "course_completed"),
      countEvents(email, "feedback_submitted"),
      getFirstEventAt(email, "analysis_completed"),
    ]);

    const properties: Record<string, string | number | boolean | null | undefined> = {
      beckett_beta_status: statusForEvent(eventName) || signup?.lifecycle_stage,
      beckett_source: signup?.source || source,
      beckett_plan: signup?.plan || "beta",
      beckett_approved_at: signup?.approved_at || undefined,
      beckett_invited_at: signup?.invite_sent_at || undefined,
      beckett_last_active_at: now,
      beckett_first_analysis_at: firstAnalysisAt || undefined,
      beckett_analysis_count: analysisCount,
      beckett_course_count: courseCount,
      beckett_feedback_count: feedbackCount,
    };

    if (eventName === "onboarding_completed") {
      properties.beckett_onboarding_completed_at = now;
    }
    if (eventName === "password_set") {
      properties.beckett_password_set_at = now;
    }
    if (eventName === "extension_installed" || eventName === "extension_login") {
      properties.beckett_extension_connected_at = now;
    }
    if (eventName === "gmail_connected") {
      properties.beckett_gmail_connected_at = now;
    }
    if (eventName === "slack_connected") {
      properties.beckett_slack_connected_at = now;
    }

    await createOrUpdateHubSpotContact({
      email,
      firstname: signup?.name?.split(" ")[0],
      lastname: signup?.name?.split(" ").slice(1).join(" "),
      plan: signup?.plan || "beta",
      source: signup?.source || source,
      properties: {
        ...properties,
        beckett_user_id: userId || undefined,
      },
    });
  } catch (error) {
    console.error("HubSpot beta event sync error:", error);
  }
}
