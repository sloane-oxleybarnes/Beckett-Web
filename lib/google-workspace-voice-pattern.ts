import type { SelectedGmailThread } from "@/lib/google-workspace-gmail";
import { supabaseAdmin } from "@/lib/server-admin";
import { summarizeSelectedGmailVoicePattern } from "@/lib/google-workspace-voice-pattern-summary";

export async function recordOptInGmailVoicePattern({
  userId,
  userEmail,
  thread,
}: {
  userId: string;
  userEmail: string;
  thread: SelectedGmailThread;
}) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("pattern_model_enabled")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.pattern_model_enabled) return { recorded: false, reason: "not_enabled" as const };

  const pattern = summarizeSelectedGmailVoicePattern(thread, userEmail);
  if (!pattern) return { recorded: false, reason: "no_user_samples" as const };

  const { data: existing } = await supabaseAdmin
    .from("user_pattern_observations")
    .select("id")
    .eq("user_id", userId)
    .eq("pattern_key", "gmail_writing_style")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const values = {
    label: "Email writing style",
    evidence_summary: pattern.evidenceSummary,
    coaching_note: pattern.coachingNote,
    confidence: pattern.confidence,
    source: "google_workspace_addon",
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabaseAdmin.from("user_pattern_observations").update(values).eq("id", existing.id)
    : await supabaseAdmin.from("user_pattern_observations").insert({
        user_id: userId,
        pattern_key: "gmail_writing_style",
        ...values,
      });
  if (error) throw error;
  return { recorded: true, reason: null };
}
