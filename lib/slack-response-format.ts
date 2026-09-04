export type TemplatedSlackIntent = "decode" | "respond" | "rewrite" | "prep" | "practice";

const REWRITE_LABELS = ["Direct but kind", "Warm and collaborative", "Concise"] as const;
const RESPOND_LABELS = ["Confirm", "Negotiate", "Clarify"] as const;
const DECODE_LABELS = ["Possible read", "Next move"] as const;
const PREP_LABELS = ["Goal", "Say this first", "If they push back"] as const;

function cleanLine(value: string) {
  return value
    .replace(/^\s*(?:[-•–—]|\d+[.)])\s*/, "")
    .replace(/^\*+|\*+$/g, "")
    .replace(/^~\s*|\s*~$/g, "")
    .trim();
}

function labelPattern(labels: readonly string[]) {
  return new RegExp(`^(${labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*:?\\s*(.*)$`, "i");
}

function collectLabeledValues(text: string, labels: readonly string[]) {
  const pattern = labelPattern(labels);
  const values = new Map<string, string>();
  let currentLabel: string | null = null;

  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    const match = line.match(pattern);
    if (match) {
      currentLabel = labels.find((label) => label.toLowerCase() === match[1].toLowerCase()) || match[1];
      const inline = cleanLine(match[2] || "");
      if (inline) values.set(currentLabel, inline);
      continue;
    }
    if (currentLabel) {
      values.set(currentLabel, [values.get(currentLabel), line].filter(Boolean).join(" "));
    }
  }
  return values;
}

function unlabeledCandidates(text: string, knownLabels: readonly string[]) {
  const knownPattern = labelPattern(knownLabels);
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map(cleanLine)
    .filter((line) => line && !knownPattern.test(line) && !/^here are (?:three|3) options:?$/i.test(line));
}

function formatParallelOptions(text: string, labels: readonly string[]) {
  const values = collectLabeledValues(text, labels);
  const candidates = unlabeledCandidates(text, labels);
  const used = new Set<string>();

  return labels.map((label, index) => {
    let value = values.get(label) || "";
    if (!value) {
      value = candidates.find((candidate) => !used.has(candidate)) || candidates[index] || "";
    }
    if (value) used.add(value);
    return `- ${label}: ${value}`.trimEnd();
  }).join("\n");
}

function formatSections(text: string, labels: readonly string[]) {
  const values = collectLabeledValues(text, labels);
  const candidates = unlabeledCandidates(text, labels);
  return labels.map((label, index) => {
    const value = values.get(label) || candidates[index] || "";
    return `~ ${label} ~${value ? ` ${value}` : ""}`;
  }).join("\n");
}

function trimWords(value: string, maximumWords: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maximumWords) return value.trim();
  const slice = words.slice(0, Math.max(1, maximumWords));
  const sentenceIndex = slice.reduce(
    (last, word, index) => index >= maximumWords * 0.55 && /[.!?]["'*)\]]*$/.test(word) ? index : last,
    -1,
  );
  if (sentenceIndex >= 0) return slice.slice(0, sentenceIndex + 1).join(" ");
  return `${slice.join(" ").replace(/[,:;\-–—]+$/, "")}…`;
}

export function limitSlackDecodeWords(text: string, maximumWords: number) {
  const formatted = formatSlackInitialResponse(text, "decode");
  const currentWords = formatted.split(/\s+/).filter(Boolean);
  if (currentWords.length <= maximumWords) return formatted;

  const values = collectLabeledValues(formatted, DECODE_LABELS);
  const read = values.get("Possible read") || "";
  const move = values.get("Next move") || "";
  // Slack's tilde-delimited labels tokenize as four words each:
  // `~ Possible read ~` and `~ Next move ~`.
  const headingWords = 8;
  const contentBudget = Math.max(2, maximumWords - headingWords);
  const moveWords = move.split(/\s+/).filter(Boolean).length;
  const readWords = read.split(/\s+/).filter(Boolean).length;
  const moveBudget = Math.min(moveWords, Math.max(1, Math.round(contentBudget * 0.42)));
  const readBudget = Math.min(readWords, Math.max(1, contentBudget - moveBudget));
  const unused = contentBudget - readBudget - moveBudget;
  const finalReadBudget = Math.min(readWords, readBudget + unused);

  return [
    `~ Possible read ~ ${trimWords(read, finalReadBudget)}`,
    `~ Next move ~ ${trimWords(move, moveBudget)}`,
  ].join("\n");
}

export function normalizeSlackPracticeCopy(text: string) {
  return text
    .replace(/most useful prep/gi, "most useful practice")
    .replace(/set up (?:the|this|your) prep/gi, "set up the role-play")
    .replace(/prep exercise/gi, "practice exercise")
    .trim();
}

export function formatSlackInitialResponse(text: string, intent: TemplatedSlackIntent) {
  const cleaned = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (intent === "rewrite") return `Here are three options:\n${formatParallelOptions(cleaned, REWRITE_LABELS)}`;
  if (intent === "respond") return formatParallelOptions(cleaned, RESPOND_LABELS);
  if (intent === "decode") return formatSections(cleaned, DECODE_LABELS);
  if (intent === "prep") return formatSections(cleaned, PREP_LABELS);
  return normalizeSlackPracticeCopy(cleaned);
}

export function buildDeterministicSlackBodyBlocks(text: string, intent: TemplatedSlackIntent) {
  const formatted = formatSlackInitialResponse(text, intent);
  return formatted.split("\n").map((line) => ({
    type: "section" as const,
    text: {
      type: "mrkdwn" as const,
      text: line.replace(/^~\s*(.+?)\s*~\s*/, "*$1*\n"),
    },
  }));
}
