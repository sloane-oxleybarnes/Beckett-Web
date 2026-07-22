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

export function normalizeRelationshipTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tagPattern.test(tag))
    .slice(0, 12)));
}

export function relationshipTagLabel(tag: string) {
  return tag.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
