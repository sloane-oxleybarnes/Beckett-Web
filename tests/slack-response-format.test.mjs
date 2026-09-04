import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeterministicSlackBodyBlocks,
  formatSlackInitialResponse,
  limitSlackDecodeWords,
  normalizeSlackPracticeCopy,
} from "../lib/slack-response-format.ts";

test("Rewrite variations normalize to the same three fixed labels", () => {
  const mixed = [
    "Here are three options:",
    "• Direct but kind: Can you share an update today?",
    "Warm and collaborative",
    "Could you share where this stands when you have a moment?",
    "- Concise: Any update today?",
  ].join("\n");
  assert.equal(
    formatSlackInitialResponse(mixed, "rewrite"),
    [
      "Here are three options:",
      "- Direct but kind: Can you share an update today?",
      "- Warm and collaborative: Could you share where this stands when you have a moment?",
      "- Concise: Any update today?",
    ].join("\n")
  );
});

test("Respond always renders Confirm, Negotiate, and Clarify in parallel", () => {
  const response = formatSlackInitialResponse(
    "Confirm\nI’ll send them by 3.\nNegotiate: I can send them by 4.\n• Clarify — Which figures do you need?",
    "respond"
  );
  assert.equal((response.match(/^- /gm) || []).length, 3);
  assert.match(response, /^- Confirm:/m);
  assert.match(response, /^- Negotiate:/m);
  assert.match(response, /^- Clarify:/m);
});

test("Decode and Prep render fixed initial sections", () => {
  assert.equal(
    formatSlackInitialResponse("Possible read: This is likely a routine prep request.\nNext move\nConfirm the requested changes.", "decode"),
    "~ Possible read ~ This is likely a routine prep request.\n~ Next move ~ Confirm the requested changes."
  );
  assert.match(
    formatSlackInitialResponse("Goal: agree dates\nSay this first: Can we move these?\nIf they push back: ask what can move", "prep"),
    /^~ Goal ~[\s\S]*~ Say this first ~[\s\S]*~ If they push back ~/
  );
});

test("complete deterministic Block Kit body is stable across mixed model markup", () => {
  const blocks = buildDeterministicSlackBodyBlocks(
    "- Direct but kind: First\nWarm and collaborative:\nSecond\n• Concise: Third",
    "rewrite"
  );
  assert.deepEqual(blocks, [
    { type: "section", text: { type: "mrkdwn", text: "Here are three options:" } },
    { type: "section", text: { type: "mrkdwn", text: "- Direct but kind: First" } },
    { type: "section", text: { type: "mrkdwn", text: "- Warm and collaborative: Second" } },
    { type: "section", text: { type: "mrkdwn", text: "- Concise: Third" } },
  ]);
});

test("Practice copy cannot accidentally call the activity prep", () => {
  assert.equal(
    normalizeSlackPracticeCopy("Quick question to get you the most useful prep."),
    "Quick question to get you the most useful practice."
  );
});

test("Decode word limits preserve both required sections", () => {
  const formatted = limitSlackDecodeWords([
    "Possible read: " + "evidence ".repeat(80),
    "Next move: " + "action ".repeat(40),
  ].join("\n"), 55);
  assert.match(formatted, /^~ Possible read ~/m);
  assert.match(formatted, /^~ Next move ~/m);
  assert.ok(formatted.split(/\s+/).filter(Boolean).length <= 55);
});
