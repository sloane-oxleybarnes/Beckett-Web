import { ContactIdentifierInput, normalizeContactIdentifier } from "@/lib/contact-identifiers";
import { supabaseAdmin } from "@/lib/server-admin";

type ContactMatch = {
  id: string;
  name: string;
  notes: string | null;
  trusted: boolean;
  relationship_type: string | null;
  relationship_other: string | null;
};

type RelationshipSummary = {
  communication_style: string | null;
  recurring_tension_points: string | null;
  what_tends_to_work: string | null;
  unresolved_topics: string | null;
  generated_from: string | null;
  updated_at: string | null;
};

type RecentInteraction = {
  summary: string;
  tone_observed: string | null;
  occurred_at: string | null;
  platform: string | null;
};

export type ContactRelationshipContext = {
  contact: ContactMatch;
  identifierConfirmed: boolean;
  promptContext: string;
};

function relationshipLabel(contact: ContactMatch) {
  if (contact.relationship_type === "Other") return contact.relationship_other || "Other";
  return contact.relationship_type || null;
}

function formatRelationshipPromptContext(
  contact: ContactMatch,
  summary: RelationshipSummary | null,
  recentInteractions: RecentInteraction[] = [],
) {
  const lines = [
    `Matched Beckett contact: ${contact.name}.`,
    relationshipLabel(contact) ? `Relationship: ${relationshipLabel(contact)}.` : null,
    contact.trusted ? "This is marked as a trusted contact." : null,
    contact.notes ? `User-editable relationship notes: ${contact.notes}` : null,
    summary?.communication_style ? `Communication style: ${summary.communication_style}` : null,
    summary?.recurring_tension_points ? `Common friction: ${summary.recurring_tension_points}` : null,
    summary?.what_tends_to_work ? `Preferred approach: ${summary.what_tends_to_work}` : null,
    summary?.unresolved_topics ? `Unresolved topics: ${summary.unresolved_topics}` : null,
  ].filter(Boolean);

  if (recentInteractions.length) {
    lines.push(
      "Recent user-selected interaction summaries:",
      ...recentInteractions.map((interaction) => {
        const tone = interaction.tone_observed ? ` Tone observed: ${interaction.tone_observed}` : "";
        return `- ${interaction.summary}${tone}`;
      }),
    );
  }

  if (!lines.length) return "";
  return [
    "Relationship context from Beckett Contacts. Treat this as helpful background, not proof of current intent.",
    ...lines,
  ].join("\n");
}

export async function lookupRelationshipContextByIdentifier({
  userId,
  identifier,
  requireConfirmed = false,
}: {
  userId: string;
  identifier: ContactIdentifierInput;
  requireConfirmed?: boolean;
}): Promise<ContactRelationshipContext | null> {
  const normalized = normalizeContactIdentifier(identifier);
  if (!normalized) return null;

  const { data: identifierRow, error } = await supabaseAdmin
    .from("contact_identifiers")
    .select("contact_id, confirmed")
    .eq("user_id", userId)
    .eq("platform", normalized.platform)
    .eq("identifier", normalized.identifier)
    .maybeSingle();

  if (error || !identifierRow?.contact_id) return null;
  if (requireConfirmed && !identifierRow.confirmed) return null;

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, name, notes, trusted, relationship_type, relationship_other")
    .eq("user_id", userId)
    .eq("id", identifierRow.contact_id)
    .maybeSingle();

  if (!contact) return null;

  const { data: summary } = await supabaseAdmin
    .from("contact_relationship_summaries")
    .select("communication_style, recurring_tension_points, what_tends_to_work, unresolved_topics, generated_from, updated_at")
    .eq("user_id", userId)
    .eq("contact_id", contact.id)
    .maybeSingle();

  const { data: recentInteractions } = await supabaseAdmin
    .from("interaction_summaries")
    .select("summary, tone_observed, occurred_at, platform")
    .eq("user_id", userId)
    .eq("contact_id", contact.id)
    .order("occurred_at", { ascending: false })
    .limit(3);

  return {
    contact: contact as ContactMatch,
    identifierConfirmed: Boolean(identifierRow.confirmed),
    promptContext: formatRelationshipPromptContext(
      contact as ContactMatch,
      (summary as RelationshipSummary | null) || null,
      (recentInteractions as RecentInteraction[] | null) || [],
    ),
  };
}

export async function lookupRelationshipContextByEmail({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  for (const platform of ["email", "work_email", "personal_email"] as const) {
    const context = await lookupRelationshipContextByIdentifier({
      userId,
      identifier: { platform, identifier: email, confirmed: true },
      requireConfirmed: true,
    });
    if (context) return context;
  }
  return null;
}

export async function recordSafeInteractionSummary({
  userId,
  contactId,
  platform,
  interactionType,
  summary,
  toneObserved,
  userResponsePattern,
  suggestedFollowup,
  metadata = {},
  updateRelationshipSummary = true,
  dedupeKey,
}: {
  userId: string;
  contactId: string;
  platform: string;
  interactionType: string;
  summary: string;
  toneObserved?: string | null;
  userResponsePattern?: string | null;
  suggestedFollowup?: string | null;
  metadata?: Record<string, unknown>;
  updateRelationshipSummary?: boolean;
  dedupeKey?: string | null;
}) {
  const occurredAt = new Date().toISOString();

  if (dedupeKey) {
    const { data: existing } = await supabaseAdmin
      .from("interaction_summaries")
      .select("id")
      .eq("user_id", userId)
      .eq("contact_id", contactId)
      .eq("platform", platform)
      .contains("metadata", { dedupe_key: dedupeKey })
      .limit(1)
      .maybeSingle();
    if (existing) return { created: false };
  }

  const { error: insertError } = await supabaseAdmin.from("interaction_summaries").insert({
    user_id: userId,
    contact_id: contactId,
    platform,
    interaction_type: interactionType,
    summary,
    tone_observed: toneObserved || null,
    user_response_pattern: userResponsePattern || null,
    suggested_followup: suggestedFollowup || null,
    occurred_at: occurredAt,
    metadata: { ...metadata, ...(dedupeKey ? { dedupe_key: dedupeKey } : {}) },
  });
  if (insertError) throw insertError;

  if (!updateRelationshipSummary) return { created: true };

  const { error: summaryError } = await supabaseAdmin.from("contact_relationship_summaries").upsert(
    {
      user_id: userId,
      contact_id: contactId,
      last_interaction_at: occurredAt,
      generated_from: platform,
      updated_at: occurredAt,
    },
    { onConflict: "user_id,contact_id" }
  );
  if (summaryError) throw summaryError;
  return { created: true };
}

export async function upsertRelationshipSummary({
  userId,
  contactId,
  communicationStyle,
  recurringTensionPoints,
  whatTendsToWork,
  unresolvedTopics,
  generatedFrom,
}: {
  userId: string;
  contactId: string;
  communicationStyle?: string | null;
  recurringTensionPoints?: string | null;
  whatTendsToWork?: string | null;
  unresolvedTopics?: string | null;
  generatedFrom: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("contact_relationship_summaries")
    .upsert(
      {
        user_id: userId,
        contact_id: contactId,
        communication_style: communicationStyle || null,
        recurring_tension_points: recurringTensionPoints || null,
        what_tends_to_work: whatTendsToWork || null,
        unresolved_topics: unresolvedTopics || null,
        generated_from: generatedFrom,
        updated_at: now,
      },
      { onConflict: "user_id,contact_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}
