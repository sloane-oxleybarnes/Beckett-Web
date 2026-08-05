import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The single, deliberately small contract shared by Beckett's web surfaces.
 *
 * This module is intentionally separate from Slack and the browser extension. It
 * never reads raw connected-service content or OAuth credentials. Surfaces may
 * use the user-visible summary to explain Beckett's behavior, while AI routes
 * use only `promptContext` to personalize a response the user requested.
 */
export const SHARED_WEB_CONTEXT_VERSION = "2026-07-29";

export const SHARED_WEB_CONTEXT_SURFACES = [
  "Home",
  "Practice",
  "Skills",
  "Calendar & Meetings",
  "About Me",
] as const;

type SharedProfileRow = {
  display_name?: string | null;
  first_name?: string | null;
  full_name?: string | null;
  strengths?: string[] | null;
  workplace_triggers?: string[] | null;
  communication_preferences?: string[] | null;
  coaching_tone?: string | null;
  neurodivergent_context?: string[] | null;
  neurodivergent_context_other?: string | null;
  proactive_coaching_preference?: string | null;
  pattern_model_enabled?: boolean | null;
  home_suggestions_enabled?: boolean | null;
  skill_recommendations_enabled?: boolean | null;
  meeting_prep_learning_enabled?: boolean | null;
  safety_resource_region?: string | null;
  meeting_retention_preference?: string | null;
};

type ToolkitRow = {
  course_id?: string | null;
  category?: string | null;
  label?: string | null;
  content?: string | null;
};

type IntegrationRow = {
  provider?: string | null;
};

export type SharedWebContext = {
  version: typeof SHARED_WEB_CONTEXT_VERSION;
  surfaces: readonly (typeof SHARED_WEB_CONTEXT_SURFACES)[number][];
  profile: {
    hasCoachingPreferences: boolean;
    hasStrengths: boolean;
    hasSupportConsiderations: boolean;
  };
  choices: {
    homeSuggestions: boolean;
    privatePatternLearning: boolean;
    skillRecommendations: boolean;
    meetingPrepLearning: boolean;
    proactivity: "dashboard_only" | "gentle_notifications" | "future_proactive";
    safetyRegion: string;
  };
  connectedTools: {
    gmail: boolean;
    calendar: boolean;
  };
  savedContext: {
    toolkitItems: number;
    contacts: number;
    activeSupportPlans: number;
  };
  retention: {
    workdayLearning: "off" | "private_patterns";
    meetingPreference: "do_not_save" | "notes_only" | "summary_only";
  };
  promptContext: string;
};

function proactivityLabel(value: string | null | undefined): SharedWebContext["choices"]["proactivity"] {
  if (value === "quiet_prompt") return "gentle_notifications";
  if (value === "direct_interrupt") return "future_proactive";
  return "dashboard_only";
}

function meetingRetention(value: string | null | undefined): SharedWebContext["retention"]["meetingPreference"] {
  if (value === "do_not_save" || value === "notes_only" || value === "summary_only") return value;
  return "summary_only";
}

export function buildSharedWebContext({
  profile,
  toolkitItems = [],
  integrations = [],
  contactCount = 0,
  activeSupportPlanCount = 0,
}: {
  profile?: SharedProfileRow | null;
  toolkitItems?: ToolkitRow[];
  integrations?: IntegrationRow[];
  contactCount?: number;
  activeSupportPlanCount?: number;
}): SharedWebContext {
  const providers = new Set(integrations.map((integration) => integration.provider).filter(Boolean));
  const privatePatternLearning = profile?.pattern_model_enabled === true;

  return {
    version: SHARED_WEB_CONTEXT_VERSION,
    surfaces: SHARED_WEB_CONTEXT_SURFACES,
    profile: {
      hasCoachingPreferences: Boolean(profile?.communication_preferences?.length || profile?.coaching_tone),
      hasStrengths: Boolean(profile?.strengths?.length),
      hasSupportConsiderations: Boolean(profile?.workplace_triggers?.length || profile?.neurodivergent_context?.length || profile?.neurodivergent_context_other),
    },
    choices: {
      homeSuggestions: profile?.home_suggestions_enabled !== false,
      privatePatternLearning,
      skillRecommendations: privatePatternLearning && profile?.skill_recommendations_enabled === true,
      meetingPrepLearning: privatePatternLearning && profile?.meeting_prep_learning_enabled === true,
      proactivity: proactivityLabel(profile?.proactive_coaching_preference),
      safetyRegion: profile?.safety_resource_region || "US",
    },
    connectedTools: {
      gmail: providers.has("google"),
      calendar: providers.has("google_calendar") || providers.has("microsoft"),
    },
    savedContext: {
      toolkitItems: toolkitItems.length,
      contacts: Math.max(0, contactCount),
      activeSupportPlans: Math.max(0, activeSupportPlanCount),
    },
    retention: {
      workdayLearning: privatePatternLearning ? "private_patterns" : "off",
      meetingPreference: meetingRetention(profile?.meeting_retention_preference),
    },
    promptContext: formatSharedPromptContext(profile, toolkitItems),
  };
}

export function formatSharedPromptContext(profile?: SharedProfileRow | null, toolkitItems: ToolkitRow[] = []) {
  const profileLines = [
    profile?.display_name || profile?.first_name || profile?.full_name
      ? `Preferred name: ${profile?.display_name || profile?.first_name || profile?.full_name}.`
      : null,
    profile?.communication_preferences?.length
      ? `What the user wants help with: ${profile.communication_preferences.join(", ")}.`
      : null,
    profile?.coaching_tone ? `Preferred coaching tone: ${profile.coaching_tone.replace(/_/g, " ")}.` : null,
    profile?.strengths?.length ? `Communication strengths to preserve: ${profile.strengths.join(", ")}.` : null,
    profile?.workplace_triggers?.length ? `Moments to handle carefully: ${profile.workplace_triggers.join(", ")}.` : null,
    profile?.neurodivergent_context?.length || profile?.neurodivergent_context_other
      ? `Optional user-provided context: ${[
          ...(profile.neurodivergent_context || []).filter((item) => item !== "Something else"),
          profile.neurodivergent_context_other || null,
        ].filter(Boolean).join(", ")}.`
      : null,
    toolkitItems.length
      ? `Saved phrases the user may want Beckett to adapt:\n${toolkitItems
          .filter((item) => typeof item.content === "string" && item.content.trim())
          .slice(0, 5)
          .map((item) => `- ${item.label || item.category || "Saved phrase"}: "${item.content!.replace(/\s+/g, " ").trim().slice(0, 220)}"`)
          .join("\n")}`
      : null,
  ].filter(Boolean);

  if (!profileLines.length) return "";

  return [
    "Shared Beckett coaching context (use only to tailor a response the user requested):",
    profileLines.join("\n"),
    "Do not mention this context unprompted, infer a diagnosis or intent from it, or claim access to any connected-service content. Use specific contact context only when it is explicitly provided for the current request.",
  ].join("\n");
}

/** Fetches a safe account summary. Errors in an optional data source never block coaching. */
export async function fetchSharedWebContext(supabase: SupabaseClient, userId: string) {
  const [profileResult, toolkitResult, integrationsResult, contactsResult, supportPlansResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, first_name, full_name, strengths, workplace_triggers, communication_preferences, coaching_tone, neurodivergent_context, neurodivergent_context_other, proactive_coaching_preference, pattern_model_enabled, home_suggestions_enabled, skill_recommendations_enabled, meeting_prep_learning_enabled, safety_resource_region, meeting_retention_preference")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("course_toolkit_items")
      .select("course_id, category, label, content")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase.from("user_integrations").select("provider").eq("user_id", userId),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("workday_support_plans").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("active", true),
  ]);

  return buildSharedWebContext({
    profile: profileResult.data as SharedProfileRow | null,
    toolkitItems: (toolkitResult.data || []) as ToolkitRow[],
    integrations: (integrationsResult.data || []) as IntegrationRow[],
    contactCount: contactsResult.count || 0,
    activeSupportPlanCount: supportPlansResult.count || 0,
  });
}
