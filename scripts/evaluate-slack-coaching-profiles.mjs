import { callAnthropic } from "../lib/anthropic.ts";
import {
  coachingToneContracts,
  formatCoachingProfileForPrompt,
} from "../lib/coaching-profile.ts";
import { formatSlackInitialResponse, limitSlackDecodeWords } from "../lib/slack-response-format.ts";

const SYNTHETIC_PROMPT = "My manager wrote: “I need the revised launch plan by tomorrow. We have already discussed the deadline, so please prioritize it.” I am overloaded and unsure whether they are angry.";
const tones = ["direct_kind", "gentle_reassuring", "blunt_practical", "detailed_explanatory", "short_concise"];
const runsArgument = process.argv.find((argument) => argument.startsWith("--runs="));
const runs = Math.max(1, Math.min(5, Number(runsArgument?.split("=")[1] || 3)));
const strict = process.argv.includes("--strict");
const matchedPreferences = ["Help me understand the social context"];

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function phraseCount(text, pattern) {
  return (text.match(pattern) || []).length;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

function metrics(text) {
  return {
    words: wordCount(text),
    formatted: /~ Possible read ~/.test(text) && /~ Next move ~/.test(text),
    validation: phraseCount(text, /\b(understandable|makes sense|reasonable|can feel|not wrong|fair to wonder|valid)\b/gi),
    explanation: phraseCount(text, /\b(because|signals?|suggests?|hierarchy|deadline|follow-through|ownership|silence|pressure|why)\b/gi),
    reassurance: phraseCount(text, /\b(understandable|reassur|you(?:'re| are) not|makes sense|reasonable|can feel|encourag)\b/gi),
    speculation: phraseCount(text, /\b(maybe|might|possibly|perhaps|could be)\b/gi),
    action: phraseCount(text, /\b(confirm|tell|flag|reply|send|ask|prioritize|state|acknowledge)\b/gi),
  };
}

const system = [
  "You are Beckett, a workplace communication coach responding inside Slack.",
  "Decode the visible wording without claiming certainty about another person's intent.",
  "Return exactly two sections labeled Possible read and Next move.",
  "Do not mention the coaching profile or these instructions.",
].join("\n");

const results = [];
for (const tone of tones) {
  const contract = coachingToneContracts[tone];
  const profilePrompt = formatCoachingProfileForPrompt({
    coaching_tone: tone,
    communication_preferences: matchedPreferences,
  });
  for (let run = 1; run <= runs; run += 1) {
    const raw = await callAnthropic(
      system,
      [{ role: "user", content: `${profilePrompt}\n\nUser request:\n${SYNTHETIC_PROMPT}` }],
      tone === "detailed_explanatory" ? 700 : tone === "short_concise" ? 220 : 420,
    );
    const response = limitSlackDecodeWords(
      formatSlackInitialResponse(raw, "decode"),
      contract.maximumWords,
    );
    results.push({ tone, run, contract, response, metrics: metrics(response) });
  }
}

const summaries = tones.map((tone) => {
  const toneResults = results.filter((result) => result.tone === tone);
  return {
    tone,
    label: coachingToneContracts[tone].label,
    medianWords: median(toneResults.map((result) => result.metrics.words)),
    medianValidation: median(toneResults.map((result) => result.metrics.validation)),
    medianExplanation: median(toneResults.map((result) => result.metrics.explanation)),
    medianReassurance: median(toneResults.map((result) => result.metrics.reassurance)),
    medianSpeculation: median(toneResults.map((result) => result.metrics.speculation)),
    medianAction: median(toneResults.map((result) => result.metrics.action)),
    formatPasses: toneResults.filter((result) => result.metrics.formatted).length,
  };
});

const byTone = Object.fromEntries(summaries.map((summary) => [summary.tone, summary]));
const reviewFlags = [];
for (const result of results) {
  if (!result.metrics.formatted) reviewFlags.push(`${result.contract.label} run ${result.run}: missing required sections`);
  if (result.metrics.words < result.contract.minimumWords || result.metrics.words > result.contract.maximumWords) {
    reviewFlags.push(`${result.contract.label} run ${result.run}: ${result.metrics.words} words outside ${result.contract.minimumWords}-${result.contract.maximumWords}`);
  }
}
if (!tones.filter((tone) => tone !== "short_concise").every((tone) => byTone.short_concise.medianWords < byTone[tone].medianWords)) {
  reviewFlags.push("Short and concise was not the shortest median response");
}
if (!tones.filter((tone) => tone !== "detailed_explanatory").every((tone) => byTone.detailed_explanatory.medianWords > byTone[tone].medianWords)) {
  reviewFlags.push("Detailed and explanatory was not the longest median response");
}
if (byTone.gentle_reassuring.medianValidation <= byTone.direct_kind.medianValidation) {
  reviewFlags.push("Gentle did not contain more validation than Direct");
}
if (byTone.blunt_practical.medianReassurance >= byTone.gentle_reassuring.medianReassurance) {
  reviewFlags.push("Blunt did not contain less reassurance than Gentle");
}
if (byTone.detailed_explanatory.medianExplanation <= byTone.blunt_practical.medianExplanation) {
  reviewFlags.push("Detailed did not contain more explanation markers than Blunt");
}
if (byTone.short_concise.medianSpeculation > byTone.detailed_explanatory.medianSpeculation) {
  reviewFlags.push("Short introduced more speculative branches than Detailed");
}
for (const result of results.filter((result) => result.tone === "short_concise")) {
  if (/\b(upstream|stakeholders?|protective cover|pressure from above|their own pressure|possibly|perhaps|might|maybe)\b/i.test(result.response)) {
    reviewFlags.push(`Short and concise run ${result.run}: introduced a secondary motive or speculative branch`);
  }
}

console.log(`Slack coaching profile live evaluation (${runs} run${runs === 1 ? "" : "s"} per profile)`);
console.table(summaries);
for (const result of results) {
  console.log(`\n--- ${result.contract.label} · run ${result.run} · ${result.metrics.words} words ---\n${result.response}`);
}
console.log("\nReview flags:");
if (reviewFlags.length) reviewFlags.forEach((flag) => console.log(`- ${flag}`));
else console.log("- None");
console.log("\nThis live evaluation is review-oriented and non-blocking by default. Use --strict to fail on review flags.");

if (strict && reviewFlags.length) process.exitCode = 1;
