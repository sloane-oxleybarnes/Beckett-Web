export function extractJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return cleaned.startsWith("{") ? cleaned : cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned;
}

export function parseJsonObject<T>(text: string): T {
  return JSON.parse(extractJsonObject(text)) as T;
}
