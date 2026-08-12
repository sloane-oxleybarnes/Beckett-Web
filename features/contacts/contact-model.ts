import { relationshipLabelForContact, type RelationshipTagDefinition } from "@/lib/relationship-tags";

export type ContactIdentifier = {
  id?: string;
  platform: string;
  identifier: string;
  label: string | null;
  confirmed: boolean | null;
};

export type RelationshipSummary = {
  communication_style: string | null;
  recurring_tension_points: string | null;
  what_tends_to_work: string | null;
  unresolved_topics: string | null;
  generated_from: string | null;
  updated_at: string | null;
};

export type ContactInsights = {
  summary: string | null;
  communication_patterns: string | null;
  common_topics: string | null;
  tone_trend: string | null;
  responsiveness: string | null;
  generated_at: string | null;
};

export type Contact = {
  id: string;
  name: string;
  email: string | null;
  slack_handle: string | null;
  phone_number: string | null;
  relationship_type: string | null;
  relationship_other: string | null;
  relationship_tags?: string[] | null;
  primary_relationship_tag?: string | null;
  notes: string | null;
  trusted: boolean;
  created_at: string;
  contact_identifiers?: ContactIdentifier[];
  contact_insights?: ContactInsights | null;
  contact_relationship_summaries?: RelationshipSummary | RelationshipSummary[] | null;
};

export const additionalIdentifierOptions = [
  { value: "work_email", label: "Work email" },
  { value: "personal_email", label: "Personal email" },
  { value: "mobile", label: "Mobile" },
  { value: "slack_user_id", label: "Confirmed Slack user ID" },
];

export function emptyContactForm() {
  return {
    name: "",
    email: "",
    slack_handle: "",
    phone_number: "",
    identifiers: [] as ContactIdentifier[],
    relationship_tags: [] as string[],
    primary_relationship_tag: "",
    notes: "",
    trusted: false,
  };
}

export function contactRelationshipLabel(
  contact: Pick<Contact, "relationship_type" | "relationship_other" | "relationship_tags" | "primary_relationship_tag">,
  definitions: RelationshipTagDefinition[] = [],
) {
  return relationshipLabelForContact(contact, definitions);
}

export function normalizeContactFromApi(contact: Contact): Contact {
  const rawInsights = contact.contact_insights as ContactInsights | ContactInsights[] | null | undefined;
  const insights = Array.isArray(rawInsights) ? rawInsights[0] || null : rawInsights || null;
  const relationshipSummary = Array.isArray(contact.contact_relationship_summaries)
    ? contact.contact_relationship_summaries[0] || null
    : contact.contact_relationship_summaries || null;

  return {
    ...contact,
    contact_identifiers: contact.contact_identifiers || [],
    contact_insights: insights,
    contact_relationship_summaries: relationshipSummary,
  };
}

export function identifierLabel(identifier: ContactIdentifier) {
  if (identifier.label) return identifier.label;
  const found = additionalIdentifierOptions.find((option) => option.value === identifier.platform);
  if (found) return found.label;
  if (identifier.platform === "email") return "Email";
  if (identifier.platform === "slack") return "Slack display";
  if (identifier.platform === "phone") return "Phone";
  return identifier.platform.replace(/_/g, " ");
}

export function isLegacyIdentifier(identifier: ContactIdentifier) {
  return identifier.platform === "email" || identifier.platform === "slack" || identifier.platform === "phone";
}
