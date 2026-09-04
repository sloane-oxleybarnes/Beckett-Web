import assert from "node:assert/strict";
import test from "node:test";
import { buildSlackCommandExcerpt } from "../lib/slack-command-copy.ts";
import { readFileSync } from "node:fs";
import { slackPracticeGoalQuestion } from "../lib/slack-practice-copy.ts";

test("slash command roots show a short, safe copy of the original input", () => {
  assert.equal(
    buildSlackCommandExcerpt("rewrite", '"I need the scope to stop changing."'),
    "Original draft: “I need the scope to stop changing.”"
  );
  assert.equal(
    buildSlackCommandExcerpt("decode", "Please ask <@U123> & confirm"),
    "Original message: “Please ask &lt;@U123&gt; &amp; confirm”"
  );
  assert.equal(buildSlackCommandExcerpt("prep", "Talk to my manager"), "");
  assert.match(buildSlackCommandExcerpt("respond", "x".repeat(220)), /…”$/);
});

test("linked and Guest Slack surfaces use Practice-specific wording", () => {
  assert.match(slackPracticeGoalQuestion("your manager"), /role-play as your manager/i);
  assert.match(slackPracticeGoalQuestion("your manager"), /practice getting better at/i);
  assert.doesNotMatch(slackPracticeGoalQuestion("your manager"), /useful prep/i);

  const commands = readFileSync(new URL("../app/api/slack/commands/route.ts", import.meta.url), "utf8");
  const interactions = readFileSync(new URL("../features/slack/interactions/core-actions.ts", import.meta.url), "utf8");
  for (const source of [commands, interactions]) {
    assert.doesNotMatch(source, /Guest mode is on for judging/);
    assert.doesNotMatch(source, /Connecting Slack adds profile, contacts, history, and saved conversations/);
  }
});

test("guided flow inference does not treat Slack source metadata as the future conversation medium", () => {
  const guidedPrep = readFileSync(
    new URL("../features/slack/guided-prep/index.ts", import.meta.url),
    "utf8"
  );
  assert.match(guidedPrep, /const answers = initialAnswers\(prompt, intent,/);
  assert.doesNotMatch(guidedPrep, /const answers = initialAnswers\(seededPrompt, intent,/);
});
