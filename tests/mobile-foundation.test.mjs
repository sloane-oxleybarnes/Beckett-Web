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
  assert.match(route, /mobile_safety_redirect/);
  assert.match(route, /usage/);
  assert.match(route, /mobileUserVoiceInstruction/);
});

test("mobile coaching addresses the user directly instead of by profile name", async () => {
  const contracts = await readFile(new URL("../lib/mobile-result-contracts.ts", import.meta.url), "utf8");
  assert.match(contracts, /directly to the user using "you" and "your\."/);
  assert.match(contracts, /Never refer to the user by their preferred name/);
  assert.match(contracts, /Suggested messages must be written from the user's perspective in first person/);
});

test("mobile v1 offers transient retention only", async () => {
  const consent = await readFile(new URL("../lib/mobile-consent.ts", import.meta.url), "utf8");
  assert.match(consent, /mobileRetentionModes = \["transient"\]/);
  assert.doesNotMatch(consent, /mobileRetentionModes = \[[^\]]*save_on_request/);
});

test("mobile session reports current credit usage", async () => {
  const route = await readFile(new URL("../app/api/mobile/v1/session/route.ts", import.meta.url), "utf8");
  assert.match(route, /metering\.ai\.report/);
  assert.match(route, /usage/);
});

test("mobile onboarding stays native and requires bearer auth plus current agreements", async () => {
  const [route, setupView, authStore, signInView] = await Promise.all([
    readFile(new URL("../app/api/mobile/v1/onboarding/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Auth/AccountSetupView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Auth/AuthStore.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Auth/SignInView.swift", import.meta.url), "utf8"),
  ]);

  assert.match(route, /getMobileUser\(request\)/);
  assert.match(route, /hasRequiredBetaConsentSubmission/);
  assert.match(route, /first_login_complete:\s*true/);
  assert.match(route, /BETA_CONSENT_VERSIONS/);
  assert.match(authStore, /api\/mobile\/v1\/onboarding/);
  assert.doesNotMatch(setupView, /Continue setup on meetbeckett\.co/);
  assert.match(setupView, /Finish setup/);
  assert.match(signInView, /Verification code/);
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

test("share extension supports text, images, local OCR, selection, and opaque handoff", async () => {
  const [controller, plist, models, app] = await Promise.all([
    readFile(new URL("../ios/BeckettShare/ShareViewController.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettShare/Info.plist", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettCore/Models/MobileModels.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/App/BeckettApp.swift", import.meta.url), "utf8"),
  ]);
  assert.match(plist, /NSExtensionActivationSupportsText/);
  assert.match(plist, /NSExtensionActivationSupportsImageWithMaxCount<\/key><integer>5<\/integer>/);
  assert.match(controller, /VNRecognizeTextRequest/);
  assert.match(controller, /automaticallyDetectsLanguage = true/);
  assert.match(controller, /Use selection/);
  assert.match(controller, /extensionContext\?\.open/);
  assert.match(models, /pending-coach-handoff\.json/);
  assert.match(models, /completeFileProtection/);
  assert.match(models, /beckett:\/\/coach\/handoff\?id=/);
  assert.doesNotMatch(models, /beckett:\/\/coach\/handoff\?[^\n]*text=/);
  assert.match(app, /MobileCoachHandoffStore\.consume/);
});

test("coach scrolls to the top when a result is displayed or cleared", async () => {
  const view = await readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8");
  assert.match(view, /ScrollViewReader/);
  assert.match(view, /onChange\(of: coach\.response\?\.requestId\)/);
  assert.match(view, /proxy\.scrollTo\("coach-top", anchor: \.top\)/);
});

test("coach screen uses a compact Beckett header and places usage below the editor", async () => {
  const [view, theme] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettCore/Design/BeckettTheme.swift", import.meta.url), "utf8"),
  ]);
  assert.match(view, /navigationTitle\("Beckett"\)/);
  assert.match(view, /navigationBarTitleDisplayMode\(\.inline\)/);
  assert.match(view, /ToolbarItem\(placement: \.principal\)[\s\S]*BeckettBrandHeader\(\)/);
  assert.match(theme, /struct BeckettBrandHeader: View/);
  assert.match(theme, /BeckettLogoMark\(\)/);
  assert.match(view, /BeckettCard[\s\S]*creditsView[\s\S]*Button\(action: submit\)/);
  assert.doesNotMatch(view, /navigationTitle\("Coach"\)/);
});

test("mobile coaching presents the same three actions as web", async () => {
  const models = await readFile(new URL("../ios/BeckettCore/Models/MobileModels.swift", import.meta.url), "utf8");
  const coach = await readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8");
  const share = await readFile(new URL("../ios/BeckettShare/ShareViewController.swift", import.meta.url), "utf8");
  assert.match(models, /visibleCases: \[MobileCoachAction\] = \[\.decode, \.respond, \.rewrite\]/);
  assert.match(coach, /ForEach\(MobileCoachAction\.visibleCases\)[\s\S]*in: Circle\(\)/);
  assert.match(coach, /ForEach\(MobileCoachAction\.visibleCases\)/);
  assert.match(share, /ForEach\(MobileCoachAction\.visibleCases\)/);
});

test("signed-in navigation remains visible on coach and profile detail screens", async () => {
  const [root, coach, profile] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/App/RootView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Profile/ProfileView.swift", import.meta.url), "utf8"),
  ]);
  assert.match(root, /toolbar\(\.visible, for: \.tabBar\)/);
  assert.match(coach, /toolbar\(\.visible, for: \.tabBar\)/);
  assert.match(profile, /NavigationLink\("Review privacy choices"\)/);
  assert.doesNotMatch(profile, /\.sheet\(isPresented:/);
});

test("coach uses an in-field message prompt instead of an input heading", async () => {
  const view = await readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8");
  assert.match(view, /if coach\.text\.isEmpty/);
  assert.match(view, /Text\(coach\.selectedAction\.inputPlaceholder\)/);
  assert.match(view, /case \.decode, \.respond, \.clarify: "Paste message here"/);
  assert.doesNotMatch(view, /Text\(coach\.selectedAction\.inputTitle\)/);
});
