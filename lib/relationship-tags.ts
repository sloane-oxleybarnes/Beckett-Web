export const relationshipTagOptions = [
  "colleague",
  "manager",
  "direct_report",
  "client",
  "friend",
  "family",
  "roommate",
  "dating",
  "partner",
  "mentor",
] as const;

const tagPattern = /^[a-z0-9][a-z0-9 _-]{0,38}$/;

export type RelationshipTagDefinition = {
  id: string;
  tag_key: string;
  label: string;
};

export type ContactRelationshipFields = {
  relationship_tags?: string[] | null;
  primary_relationship_tag?: string | null;
  relationship_type?: string | null;
  relationship_other?: string | null;
};

const legacyRelationshipTags: Record<string, string> = {
  manager: "manager",
  "direct report": "direct_report",
  teammate: "colleague",
  "cross-functional colleague": "colleague",
  "client/customer": "client",
  "vendor/partner": "partner",
  "friend at work": "friend",
};

export function normalizeRelationshipTag(tag: unknown): string | null {
  if (typeof tag !== "string") return null;
  const normalized = tag.trim().toLowerCase();
  return tagPattern.test(normalized) ? normalized : null;
}

export function normalizeRelationshipTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input
    .map(normalizeRelationshipTag)
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 12)));
}

export function isStandardRelationshipTag(tag: string) {
  return (relationshipTagOptions as readonly string[]).includes(tag);
}

export function relationshipTagLabel(tag: string, definitions: RelationshipTagDefinition[] = []) {
  const customTag = definitions.find((definition) => definition.tag_key === tag);
  if (customTag) return customTag.label;
  return tag.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function relationshipTagsForContact(contact: ContactRelationshipFields): string[] {
  const savedTags = normalizeRelationshipTags(contact.relationship_tags);
  if (savedTags.length) return savedTags;

  if (contact.relationship_type === "Other") {
    const other = normalizeRelationshipTag(contact.relationship_other);
    return other ? [other] : [];
  }

  const legacy = contact.relationship_type?.trim().toLowerCase();
  return legacy && legacyRelationshipTags[legacy] ? [legacyRelationshipTags[legacy]] : [];
}

export function primaryRelationshipTagForContact(contact: ContactRelationshipFields): string | null {
  const tags = relationshipTagsForContact(contact);
  const primary = normalizeRelationshipTag(contact.primary_relationship_tag);
  return primary && tags.includes(primary) ? primary : tags[0] || null;
}

export function relationshipLabelForContact(contact: ContactRelationshipFields, definitions: RelationshipTagDefinition[] = []) {
  const tags = relationshipTagsForContact(contact);
  const primary = primaryRelationshipTagForContact(contact);
  const ordered = primary ? [primary, ...tags.filter((tag) => tag !== primary)] : tags;
  return ordered.map((tag) => relationshipTagLabel(tag, definitions)).join(", ");
}
