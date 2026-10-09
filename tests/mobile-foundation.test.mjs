import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MOBILE_RESULT_CONTRACT_VERSION,
  hasUsableMobileDraftOptions,
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

test("draft options reject placeholders and require three complete messages", () => {
  const result = normalizeMobileCoachResult("respond", {
    options: [
      { style: "direct", text: "Direct draft" },
      { style: "warm", text: "Thanks for checking in — yes, I can send it Friday." },
      { style: "balanced", text: "Balanced response" },
    ],
  });

  assert.equal(result.type, "draft_options");
  assert.deepEqual(result.options.map((option) => option.style), ["warm"]);
  assert.equal(hasUsableMobileDraftOptions(result), false);
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
  const modelCall = route.indexOf("const response = await callAnthropic(");
  assert.ok(consentCheck > -1);
  assert.ok(modelCall > consentCheck);
  assert.match(route, /contentSaved:\s*false/);
  assert.match(route, /mobile_safety_redirect/);
  assert.match(route, /usage/);
  assert.match(route, /mobileUserVoiceInstruction/);
  assert.match(route, /messageHelpTask\(action\)/);
  assert.match(route, /Stay under 250 words total/);
  assert.match(route, /\s900,\s*\)/);
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
  assert.match(controller, /Picker\("Conversation context", selection: \$model\.contextMode\)/);
  assert.match(controller, /contextMode: contextMode/);
  assert.match(controller, /Label\("Copy & close", systemImage: "doc\.on\.doc"\)/);
  assert.match(controller, /reading\.evidenceStrengthLabel/);
  assert.match(controller, /Feedback on your original/);
  assert.match(controller, /beckettBrandNavigation\(\)/);
  assert.match(controller, /try model\.saveHandoff\(\)/);
  assert.doesNotMatch(controller, /extensionContext\?\.open/);
  assert.match(controller, /Open Beckett to continue this conversation in Inbox/);
  assert.match(models, /pending-coach-handoff\.json/);
  assert.match(models, /completeFileProtection/);
  assert.match(models, /let contextMode: MobileContextMode\?/);
  assert.match(models, /beckett:\/\/coach\/handoff\?id=/);
  assert.doesNotMatch(models, /beckett:\/\/coach\/handoff\?[^\n]*text=/);
  assert.match(app, /MobileCoachHandoffStore\.consume/);
});

test("mobile failure fixes guard voice input and route pending handoffs", async () => {
  const [learning, root, route] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/LearningViews.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/App/RootView.swift", import.meta.url), "utf8"),
    readFile(new URL("../app/api/mobile/v1/coach/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(learning, /guard session\.isInputAvailable/);
  assert.match(root, /\.onAppear \{\s*if handoff\.pending != nil \{ selectedTab = 0 \}/);
  assert.match(route, /hasUsableMobileDraftOptions/);
  assert.match(route, /generateResult\(true\)/);
});

test("iOS publishes secure App Intents for Siri, Spotlight, and the Action button", async () => {
  const [intents, app, coach, models, project] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/App/BeckettAppIntents.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/App/BeckettApp.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettCore/Models/MobileModels.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/Beckett.xcodeproj/project.pbxproj", import.meta.url), "utf8"),
  ]);
  assert.match(intents, /struct DecodeWithBeckettIntent: AppIntent/);
  assert.match(intents, /struct RespondWithBeckettIntent: AppIntent/);
  assert.match(intents, /struct RewriteWithBeckettIntent: AppIntent/);
  assert.match(intents, /struct BeckettShortcuts: AppShortcutsProvider/);
  assert.match(intents, /openAppWhenRun: Bool \{ true \}/);
  assert.match(intents, /authenticationPolicy: IntentAuthenticationPolicy \{ \.requiresAuthentication \}/);
  assert.match(intents, /inputConnectionBehavior: \.connectToPreviousIntentResult/);
  assert.match(intents, /source: "app_intent"/);
  assert.match(intents, /MobileCoachHandoffStore\.save/);
  assert.doesNotMatch(intents, /beckett:\/\/coach[^\n]*message=/);
  assert.match(models, /static func consumePending/);
  assert.match(app, /handoff\.receivePending\(\)/);
  assert.match(coach, /pending\.submitImmediately == true/);
  assert.match(project, /BeckettAppIntents\.swift in Sources/);
});

test("mobile Inbox supports transient follow-up coaching and Practice handoff", async () => {
  const [route, store, view, root] = await Promise.all([
    readFile(new URL("../app/api/mobile/v1/inbox/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachStore.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/App/RootView.swift", import.meta.url), "utf8"),
  ]);
  assert.match(route, /getMobileUser\(request\)/);
  assert.match(route, /hasCurrentMobileAiConsent\(privacy\)/);
  assert.match(route, /hasCurrentBetaConsent/);
  assert.match(route, /getSafetyResponse/);
  assert.match(route, /mobile_inbox_follow_up/);
  assert.match(route, /contentSaved: false/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(route, /\.from\("[^"]*inbox/);
  assert.match(store, /api\/mobile\/v1\/inbox/);
  assert.match(store, /followUpMessages\.append\(InboxMessage\(role: \.assistant/);
  assert.match(view, /Keep talking with Beckett/);
  assert.match(view, /Ask a follow-up/);
  assert.match(view, /PracticeResultButton\(onPractice: practiceConversation\)/);
  assert.match(view, /coach\.followUpMessages\.map/);
  assert.match(root, /Label\("Inbox", systemImage:/);
});

test("coach scrolls to the top when a result is displayed or cleared", async () => {
  const view = await readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8");
  assert.match(view, /ScrollViewReader/);
  assert.match(view, /onChange\(of: coach\.response\?\.requestId\)/);
  assert.match(view, /proxy\.scrollTo\("coach-top", anchor: \.top\)/);
});

test("Inbox results hide the context toggle and use the branded result label", async () => {
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
  assert.ok(view.indexOf("InboxFollowUpView(") < view.indexOf("PracticeResultButton(onPractice: practiceConversation)"));
  assert.match(view, /Text\("Feedback on your original message"\)/);
  assert.match(view, /feedbackRow\(title: "Tone"/);
  assert.match(view, /feedbackRow\(title: "Clarity"/);
  assert.doesNotMatch(view, /ResultList\(title: "Questions you could ask"/);
  assert.doesNotMatch(view, /ResultList\(title: "Intent kept"/);
  assert.doesNotMatch(view, /Text\(option\.rationale\)/);
  assert.doesNotMatch(view, /Text\("Beckett’s read"\)[\s\S]*design: \.serif/);
});

test("Inbox uses the real Beckett brand asset and places usage below the editor", async () => {
  const [view, theme, root] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettCore/Design/BeckettTheme.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/App/RootView.swift", import.meta.url), "utf8"),
  ]);
  assert.match(view, /beckettBrandNavigation\(\)/);
  assert.match(root, /Label\("Inbox"/);
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
  assert.match(theme, /static let primary = adaptive\(light: rgb\(186, 117, 23\), dark: rgb\(216, 151, 62\)\)/);
  assert.match(theme, /static let background = adaptive\(light: rgb\(251, 248, 243\), dark: rgb\(18, 17, 15\)\)/);
  assert.match(theme, /static let card = adaptive\(light: \.white, dark: rgb\(34, 31, 27\)\)/);
  assert.match(theme, /traits\.userInterfaceStyle == \.dark \? dark : light/);
  assert.match(theme, /configuration\.isPressed \? BeckettColor\.primaryDark : BeckettColor\.primary/);
  assert.match(root, /toolbarBackground\(BeckettColor\.background, for: \.tabBar\)/);
  assert.doesNotMatch(theme, /systemGroupedBackground|secondarySystemGroupedBackground/);
});

test("result drafts remain readable to VoiceOver", async () => {
  const view = await readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8");
  assert.match(view, /\.accessibilityLabel\("\\\(option\.label\) draft\. \\\(option\.text\)"\)/);
});

test("the Beckett wordmark remains visible in dark mode", async () => {
  const theme = await readFile(new URL("../ios/BeckettCore/Design/BeckettTheme.swift", import.meta.url), "utf8");
  assert.match(theme, /@Environment\(\\\.colorScheme\)/);
  assert.match(theme, /if colorScheme == \.dark/);
  assert.match(theme, /Text\("beckett"\)/);
});

test("coaching actions adapt instead of truncating at accessibility text sizes", async () => {
  const view = await readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8");
  assert.match(view, /@Environment\(\\\.dynamicTypeSize\)/);
  assert.match(view, /dynamicTypeSize\.isAccessibilitySize/);
  assert.match(view, /actionButton\(action, horizontal: true\)/);
});

test("offline app launch preserves the stored session and offers retry", async () => {
  const [auth, root] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/Auth/AuthStore.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/App/RootView.swift", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /case offline/);
  assert.match(auth, /status == 401[\s\S]*keychain\.clear\(\)/);
  assert.match(auth, /catch \{[\s\S]*session = stored[\s\S]*state = \.offline/);
  assert.match(root, /case \.offline:[\s\S]*OfflineSessionView\(\)/);
  assert.match(root, /Button\("Try again"\)/);
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

test("decode describes evidence strength instead of ambiguous confidence", async () => {
  const [view, models] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettCore/Models/MobileModels.swift", import.meta.url), "utf8"),
  ]);
  assert.match(view, /Text\(reading\.evidenceStrengthLabel\)/);
  assert.match(models, /case "high": "Strong evidence"/);
  assert.match(models, /case "medium": "Some evidence"/);
  assert.match(models, /default: "Limited evidence"/);
  assert.doesNotMatch(view, /confidence\.capitalized/);
});

test("rewrite always shows returned feedback and full response text", async () => {
  const view = await readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8");
  assert.match(view, /if let feedback = result\.originalFeedback/);
  assert.match(view, /Text\("Feedback on your original message"\)/);
  assert.match(view, /Text\(option\.text\)\s*\.fixedSize\(horizontal: false, vertical: true\)/);
  assert.doesNotMatch(view, /TextEditor\(text: \$text\)/);
  assert.doesNotMatch(view, /action == \.rewrite, let feedback/);
});

test("professional and personal coaching use visibly distinct grounded lenses", async () => {
  const [view, route] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/Coach/CoachView.swift", import.meta.url), "utf8"),
    readFile(new URL("../app/api/mobile/v1/coach/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(view, /contextMode: contextMode/);
  assert.match(view, /Text\("\\\(contextMode\.title\) lens"\)/);
  assert.match(route, /function contextModeInstruction/);
  assert.match(route, /relationship expectations, emotional impact, closeness or distance, reassurance/);
  assert.match(route, /commitments, ownership, dependencies, timelines, decisions, feedback/);
  assert.match(route, /make the summary and possible readings meaningfully specific to this lens/);
  assert.match(route, /Never invent facts, roles, feelings, or intent to create contrast/);
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

test("mobile Practice supports native voice input and spoken replies", async () => {
  const [learning, plist] = await Promise.all([
    readFile(new URL("../ios/BeckettApp/Features/LearningViews.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/BeckettApp/Info.plist", import.meta.url), "utf8"),
  ]);
  assert.match(learning, /import AVFoundation/);
  assert.match(learning, /import Speech/);
  assert.match(learning, /enum PracticeChannel/);
  assert.match(learning, /SFSpeechAudioBufferRecognitionRequest/);
  assert.match(learning, /AVSpeechSynthesizer/);
  assert.match(learning, /voice\.speak\(reply\)/);
  assert.match(plist, /NSMicrophoneUsageDescription/);
  assert.match(plist, /NSSpeechRecognitionUsageDescription/);
});

test("mobile Courses remain available when web credit limits are disabled", async () => {
  const route = await readFile(new URL("../app/api/mobile/v1/courses/route.ts", import.meta.url), "utf8");
  assert.match(route, /!WEB_CREDITS_ENABLED \|\| await canBrowseWebCourses\(plan\)/);
  assert.match(route, /if \(WEB_CREDITS_ENABLED\) \{\s*try \{\s*await ensureWebCourseAccess/);
});
