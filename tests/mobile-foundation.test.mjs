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
  assert.equal(MOBILE_RESULT_CONTRACT_VERSION, "2026-10-08");
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
  assert.equal(result.originalFeedback, null);
});

test("rewrite results include concise feedback on the original draft", () => {
  const result = normalizeMobileCoachResult("rewrite", {
    originalFeedback: {
      tone: "Warm but slightly tentative.",
      clarity: "The request is clear.",
      strengths: ["Respectful", "Specific", "Extra"],
      watchFor: ["The apology may soften the request too much.", "Long opening", "Extra"],
    },
    options: [],
  });
  assert.equal(result.type, "draft_options");
  assert.equal(result.originalFeedback?.tone, "Warm but slightly tentative.");
  assert.equal(result.originalFeedback?.clarity, "The request is clear.");
  assert.equal(result.originalFeedback?.strengths.length, 2);
  assert.equal(result.originalFeedback?.watchFor.length, 2);
});

test("mobile results enforce concise web-aligned output limits", () => {
  const result = normalizeMobileCoachResult("decode", {
    summary: "A".repeat(500),
    clearSignals: ["One", "Two", "Three", "Four"],
    possibleReadings: [
      { label: "One", explanation: "First", evidence: "A", confidence: "medium" },
      { label: "Two", explanation: "Second", evidence: "B", confidence: "low" },
      { label: "Three", explanation: "Third", evidence: "C", confidence: "low" },
    ],
    uncertainties: ["One", "Two", "Three"],
    usefulQuestions: ["Should I reply?"],
  });
  assert.equal(result.type, "interpretation");
  assert.equal(result.summary.length, 220);
  assert.equal(result.clearSignals.length, 3);
  assert.equal(result.possibleReadings.length, 3);
  assert.equal(result.uncertainties.length, 2);
  assert.deepEqual(result.usefulQuestions, []);
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
  assert.match(route, /messageHelpTask\(action\)/);
  assert.match(route, /Stay under 250 words total/);
  assert.match(route, /\], 800\)/);
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

test("message-help results hide the context toggle and use the branded result label", async () => {
  const view = await readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8");
  const resultBranch = view.indexOf("if let response = coach.response");
  const composeView = view.indexOf("private var composeView");
  const picker = view.indexOf("ContextModePicker(selection: $contextMode)");
  assert.ok(resultBranch > -1);
  assert.ok(picker > composeView);
  assert.match(view, /Text\("BECKETT’S READ"\)[\s\S]*\.font\(\.caption\.weight\(\.bold\)\)[\s\S]*\.foregroundStyle\(BeckettColor\.primaryDark\)/);
  assert.match(view, /CoachResultView\([\s\S]*originalMessage: coach\.text/);
  assert.match(view, /Text\("ORIGINAL MESSAGE"\)[\s\S]*Text\(originalMessage\)/);
  assert.match(view, /ResultSectionLabel\("Possible readings"\)/);
  assert.match(view, /Label\("Draft response"/);
  assert.match(view, /Label\("Practice conversation"/);
  assert.match(view, /action == \.respond \|\| action == \.rewrite/);
  assert.match(view, /ResultSectionLabel\("Feedback on your original"\)/);
  assert.match(view, /feedbackRow\(title: "Tone"/);
  assert.match(view, /feedbackRow\(title: "Clarity"/);
  assert.doesNotMatch(view, /ResultList\(title: "Questions you could ask"/);
  assert.doesNotMatch(view, /ResultList\(title: "Intent kept"/);
  assert.doesNotMatch(view, /Text\(option\.rationale\)/);
  assert.doesNotMatch(view, /Text\("Beckett’s read"\)[\s\S]*design: \.serif/);
});

test("message help uses the real Beckett brand asset and places usage below the editor", async () => {
  const [view, theme, root] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettCore/Design/BeckettTheme.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/App/RootView.swift", import.meta.url), "utf8"),
  ]);
  assert.match(view, /beckettBrandNavigation\(\)/);
  assert.match(root, /Label\("Message Help"/);
  assert.match(theme, /struct BeckettBrandHeader: View/);
  assert.match(theme, /Image\("BeckettWordmark"\)/);
  assert.match(theme, /ToolbarItem\(placement: \.principal\)[\s\S]*BeckettBrandHeader\(\)/);
  assert.match(view, /BeckettCard[\s\S]*creditsView[\s\S]*Button\(action: submit\)/);
  assert.doesNotMatch(view, /navigationTitle\("Coach"\)/);
});

test("the Beckett brand header appears on every signed-in top-level section", async () => {
  const [coach, learning, profile] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/LearningViews.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Profile/ProfileView.swift", import.meta.url), "utf8"),
  ]);
  assert.equal((coach.match(/\.beckettBrandNavigation\(\)/g) ?? []).length, 1);
  assert.equal((learning.match(/\.beckettBrandNavigation\(\)/g) ?? []).length, 2);
  assert.equal((profile.match(/\.beckettBrandNavigation\(\)/g) ?? []).length, 1);
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
  assert.match(view, /var inputPlaceholder: String \{\s*"Paste message here"\s*\}/);
  assert.doesNotMatch(view, /Text\(coach\.selectedAction\.inputTitle\)/);
});

test("message help uses only the inline button loading state", async () => {
  const view = await readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8");
  assert.match(view, /coach\.isLoading \? "Preparing coaching…" : "Ask Beckett"/);
  assert.doesNotMatch(view, /CoachLoadingView/);
  assert.doesNotMatch(view, /Looking at the words and context/);
});

test("iOS uses the same warm brand palette and button states as the website", async () => {
  const [theme, root] = await Promise.all([
    readFile(new URL("../ios/BeckettCore/Design/BeckettTheme.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/App/RootView.swift", import.meta.url), "utf8"),
  ]);
  assert.match(theme, /static let primary = Color\(red: 186 \/ 255, green: 117 \/ 255, blue: 23 \/ 255\)/);
  assert.match(theme, /static let background = Color\(red: 251 \/ 255, green: 248 \/ 255, blue: 243 \/ 255\)/);
  assert.match(theme, /static let card = Color\.white/);
  assert.match(theme, /configuration\.isPressed \? BeckettColor\.primaryDark : BeckettColor\.primary/);
  assert.match(root, /toolbarBackground\(BeckettColor\.background, for: \.tabBar\)/);
  assert.doesNotMatch(theme, /systemGroupedBackground|secondarySystemGroupedBackground/);
});

test("decode caps readings at three and drafts responses in place", async () => {
  const [view, store] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachStore.swift", import.meta.url), "utf8"),
  ]);
  assert.match(view, /possibleReadings\.prefix\(3\)/);
  assert.match(view, /requestCoaching\(action: \.respond\)/);
  assert.match(view, /if isLoading \{ ProgressView\(\)\.tint\(\.white\) \}/);
  assert.doesNotMatch(view, /private func draftResponse\(\) \{\s*coach\.selectedAction = \.respond\s*coach\.startOver\(\)/);
  assert.match(store, /let requestedAction = action \?\? selectedAction/);
  assert.match(store, /selectedAction = requestedAction/);
});

test("mobile context mode is shared across Coach, Practice, and Courses", async () => {
  const [root, coachRoute, models] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/App/RootView.swift", import.meta.url), "utf8"),
    readFile(new URL("../app/api/mobile/v1/coach/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettCore/Models/MobileModels.swift", import.meta.url), "utf8"),
  ]);
  assert.match(models, /enum MobileContextMode/);
  assert.match(root, /@AppStorage\("beckett\.mobile\.context-mode"\)/);
  assert.match(root, /CoachView\(contextMode: contextMode\)/);
  assert.match(root, /practicePrefill = prefill[\s\S]*selectedTab = 1/);
  assert.match(root, /PracticeView\(contextMode: contextMode, prefill: \$practicePrefill\)/);
  assert.match(root, /CoursesView\(contextMode: contextMode\)/);
  assert.match(coachRoute, /body\.contextMode === "personal"/);
});

test("mobile Practice uses bearer auth, consent, and the shared adaptive simulator", async () => {
  const route = await readFile(new URL("../app/api/mobile/v1/practice/route.ts", import.meta.url), "utf8");
  assert.match(route, /getMobileUser\(request\)/);
  assert.match(route, /hasCurrentMobileAiConsent/);
  assert.match(route, /adaptive_conversation_sessions/);
  assert.match(route, /turnInstructions/);
  assert.match(route, /assessmentInstructions/);
});

test("mobile Courses uses the published catalog and shared progress tables", async () => {
  const route = await readFile(new URL("../app/api/mobile/v1/courses/route.ts", import.meta.url), "utf8");
  assert.match(route, /getMobileUser\(request\)/);
  assert.match(route, /getPublishedCourseCatalog/);
  assert.match(route, /getPublishedCourse/);
  assert.match(route, /course_progress/);
  assert.match(route, /course_completions/);
});
