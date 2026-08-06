import { coachingToneOptions } from "@/lib/onboarding";
import type { SupabaseClient } from "@supabase/supabase-js";

type CoachingProfileRow = {
  display_name?: string | null;
  first_name?: string | null;
  full_name?: string | null;
  strengths?: string[] | null;
  workplace_triggers?: string[] | null;
  communication_preferences?: string[] | null;
  coaching_tone?: string | null;
  neurodivergent_context?: string[] | null;
  neurodivergent_context_other?: string | null;
  pattern_model_enabled?: boolean | null;
};

type ToolkitRow = {
  course_id?: string | null;
  category?: string | null;
  label?: string | null;
  content?: string | null;
};

type PatternObservationRow = {
  label?: string | null;
  evidence_summary?: string | null;
  coaching_note?: string | null;
};

const toneLabels = new Map(coachingToneOptions.map((option) => [option.value, option.label]));

export function cleanToolkitContent(value: unknown, max = 220) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 3).trim()}...` : cleaned;
}

export function formatToolkitItemsForPrompt(items: ToolkitRow[] = [], limit = 5) {
  const lines = items
    .map((item) => {
      const content = cleanToolkitContent(item.content);
      if (!content) return null;
      const label = item.label || item.category || "Saved phrase";
      return `- ${label}: "${content}"`;
    })
    .filter(Boolean)
    .slice(0, limit);

  return lines.length
    ? `Saved Communication Toolkit phrases the user may want Beckett to reuse or adapt:\n${lines.join("\n")}`
    : "";
}

export function formatCoachingProfileForPrompt(
  profile?: CoachingProfileRow | null,
  toolkitItems: ToolkitRow[] = [],
  patternObservations: PatternObservationRow[] = [],
) {
  if (!profile) return formatToolkitItemsForPrompt(toolkitItems);

  const lines = [
    profile.display_name || profile.first_name || profile.full_name
      ? `Preferred name: ${profile.display_name || profile.first_name || profile.full_name}.`
      : null,
    profile.communication_preferences?.length
      ? `What the user wants Beckett to help with: ${profile.communication_preferences.join(", ")}.`
      : null,
    profile.coaching_tone
      ? `Preferred coaching tone: ${toneLabels.get(profile.coaching_tone as never) || profile.coaching_tone}.`
      : null,
    profile.strengths?.length
      ? `Communication strengths to preserve: ${profile.strengths.join(", ")}.`
      : null,
    profile.workplace_triggers?.length
      ? `Moments to handle carefully: ${profile.workplace_triggers.join(", ")}.`
      : null,
    profile.neurodivergent_context?.length || profile.neurodivergent_context_other
      ? `Optional neurodivergent context: ${[
          ...(profile.neurodivergent_context || []).filter((item) => item !== "Something else"),
          profile.neurodivergent_context_other || null,
        ].filter(Boolean).join(", ")}.`
      : null,
    formatToolkitItemsForPrompt(toolkitItems),
    profile.pattern_model_enabled && patternObservations.length
      ? `Opt-in communication patterns inferred from prior user-selected interactions. Treat these as preferences to preserve, not fixed traits:\n${patternObservations
          .map((observation) => `- ${observation.label || "Observed style"}: ${observation.coaching_note || observation.evidence_summary || ""}`)
          .join("\n")}`
      : null,
  ].filter(Boolean);

  return lines.length
    ? `User coaching profile. Use this to adjust tone, pacing, explanations, assumptions, and suggested wording. Do not mention this profile unless it is useful to the answer.\n${lines.join("\n")}`
    : "";
}

export async function fetchCoachingProfileContext(
  supabase: SupabaseClient,
  userId: string,
  options: { includeToolkit?: boolean; toolkitLimit?: number } = {}
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, first_name, full_name, strengths, workplace_triggers, communication_preferences, coaching_tone, neurodivergent_context, neurodivergent_context_other, pattern_model_enabled"
    )
    .eq("id", userId)
    .maybeSingle();

  let toolkitItems: ToolkitRow[] = [];
  if (options.includeToolkit !== false) {
    const { data } = await supabase
      .from("course_toolkit_items")
      .select("course_id, category, label, content, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(options.toolkitLimit || 6);
    toolkitItems = data || [];
  }

  let patternObservations: PatternObservationRow[] = [];
  if ((profile as CoachingProfileRow | null)?.pattern_model_enabled) {
    const { data } = await supabase
      .from("user_pattern_observations")
      .select("label, evidence_summary, coaching_note, updated_at")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(3);
    patternObservations = data || [];
  }

  return {
    profile: profile as CoachingProfileRow | null,
    toolkitItems,
    patternObservations,
    promptContext: formatCoachingProfileForPrompt(
      profile as CoachingProfileRow | null,
      toolkitItems,
      patternObservations,
    ),
  };
}
