import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MOBILE_RESULT_CONTRACT_VERSION,
  mobileCoachActions,
  normalizeMobileCoachResult,
  resultTypeForMobileAction,
} from "../lib/mobile-result-contracts.ts";

test("mobile actions map to three stable result formats", () => {
  assert.equal(MOBILE_RESULT_CONTRACT_VERSION, "2026-10-07");
  assert.deepEqual(new Set(mobileCoachActions.map(resultTypeForMobileAction)), new Set([
    "interpretation",
    "draft_options",
    "tone_feedback",
  ]));
});

test("interpretation results preserve evidence and calibrated confidence", () => {
  const result = normalizeMobileCoachResult("decode", {
    type: "interpretation",
    summary: "A deadline is explicit.",
    clearSignals: ["Due Friday"],
    possibleReadings: [{
      label: "Time-sensitive",
      explanation: "The sender likely wants this prioritized.",
      evidence: "The message says due Friday.",
      confidence: "medium",
    }],
    uncertainties: ["The priority relative to other work is unknown."],
    usefulQuestions: ["Should this take priority over the report?"],
  });

  assert.equal(result.type, "interpretation");
  assert.equal(result.possibleReadings[0].confidence, "medium");
  assert.match(result.possibleReadings[0].evidence, /Friday/);
});

test("draft options discard empty model output and cap options at three", () => {
  const result = normalizeMobileCoachResult("respond", {
    options: [
      { style: "direct", text: "Yes, I can send it by Friday." },
      { style: "warm", text: "Absolutely — I’ll send it by Friday." },
      { style: "balanced", text: "Yes, I’ll have it to you by Friday." },
      { style: "unknown", text: "A fourth option." },
    ],
  });

  assert.equal(result.type, "draft_options");
  assert.equal(result.options.length, 3);
  assert.deepEqual(result.options.map((option) => option.style), ["direct", "warm", "balanced"]);
});

test("tone feedback permits no rewrite when the draft already works", () => {
  const result = normalizeMobileCoachResult("tone_check", {
    likelyLanding: "Clear and respectful.",
    strengths: ["Specific request"],
    watchFor: [],
    revision: null,
  });

  assert.equal(result.type, "tone_feedback");
  assert.equal(result.revision, null);
});

test("mobile coaching requires current consent before the AI call", async () => {
  const route = await readFile(new URL("../app/api/mobile/v1/coach/route.ts", import.meta.url), "utf8");
  const consentCheck = route.indexOf("hasCurrentMobileAiConsent");
  const modelCall = route.indexOf("callAnthropic(system");
  assert.ok(consentCheck > -1);
  assert.ok(modelCall > consentCheck);
  assert.match(route, /contentSaved:\s*false/);
});

test("mobile bearer auth validates access tokens with Supabase", async () => {
  const auth = await readFile(new URL("../lib/mobile-auth.ts", import.meta.url), "utf8");
  assert.match(auth, /auth\.getUser\(token\)/);
  assert.doesNotMatch(auth, /extension_token/);
});

test("mobile privacy migration defaults to transient content", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20261007180000_mobile_privacy_preferences.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /retention_mode text not null default 'transient'/);
  assert.match(migration, /ai_processing_allowed boolean not null default false/);
  assert.match(migration, /enable row level security/);
});
