import { NextRequest, NextResponse } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError } from "@/lib/ai-usage";
import { parseJsonObject } from "@/lib/ai-json";
import { hasCurrentBetaConsent } from "@/lib/beta-consent";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { getMobileUser } from "@/lib/mobile-auth";
import { getMobilePrivacyPreferences, hasCurrentMobileAiConsent } from "@/lib/mobile-consent";
import {
  MOBILE_RESULT_CONTRACT_VERSION,
  hasUsableMobileDraftOptions,
  isMobileCoachAction,
  mobileResultJsonInstruction,
  mobileUserVoiceInstruction,
  normalizeMobileCoachResult,
  type MobileCoachAction,
} from "@/lib/mobile-result-contracts";
import { metering } from "@/lib/metering";
import { messageHelpTask } from "@/lib/message-help";
import { platformRepository } from "@/lib/repositories/platform-repository";
import { getSafetyResponse } from "@/lib/safety-resources";
import { fetchSharedWebContext } from "@/lib/shared-web-context";

type MobileCoachBody = {
  action?: unknown;
  text?: unknown;
  conversationContext?: unknown;
  person?: unknown;
  goal?: unknown;
  contextMode?: unknown;
  settings?: {
    warmth?: unknown;
    directness?: unknown;
    formality?: unknown;
    length?: unknown;
  };
  source?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function actionInstruction(action: MobileCoachAction) {
  if (action === "decode" || action === "respond" || action === "rewrite") {
    return messageHelpTask(action);
  }
  if (action === "clarify") {
    return "Draft three ways the user can ask for the missing information or expectation directly, without unnecessary apology or invented context.";
  }
  return "Assess how the user's draft may land. Name strengths and possible friction without shaming the user or treating one interpretation as certain.";
}

function contextModeInstruction(contextMode: "professional" | "personal", action: MobileCoachAction) {
  const lens = contextMode === "personal"
    ? `Personal lens: Treat ambiguous people and situations as part of the user's personal life. Focus plausible interpretations on relationship expectations, emotional impact, closeness or distance, reassurance, personal boundaries, and everyday coordination. Do not introduce workplace concepts such as deliverables, ownership, deadlines, or blocked work unless the message explicitly contains them.`
    : `Professional lens: Treat ambiguous people and situations as part of the user's work life. Focus plausible interpretations on commitments, ownership, dependencies, timelines, decisions, feedback, professional boundaries, and effects on the work. Do not frame ordinary work ambiguity as concern about personal closeness or the relationship unless the message explicitly contains it.`;

  if (action !== "decode") return lens;
  return `${lens}\nFor Decode, keep observable facts grounded in the message, but make the summary and possible readings meaningfully specific to this lens. Do not merely swap a few adjectives. Never invent facts, roles, feelings, or intent to create contrast.`;
}

export async function POST(request: NextRequest) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as MobileCoachBody | null;
  if (!isMobileCoachAction(body?.action)) {
    return NextResponse.json({ error: "Choose a supported coaching action." }, { status: 400 });
  }
  const action = body.action;
  const text = clean(body.text, 12_000);
  if (!text) return NextResponse.json({ error: "Add a message or draft." }, { status: 400 });

  const privacy = await getMobilePrivacyPreferences(user.id);
  if (!hasCurrentMobileAiConsent(privacy)) {
    return NextResponse.json({
      error: "Review how Beckett processes selected content before requesting coaching.",
      code: "mobile_ai_consent_required",
    }, { status: 403 });
  }

  const conversationContext = clean(body.conversationContext, 12_000);
  const person = clean(body.person, 160);
  const goal = clean(body.goal, 600);
  const contextMode = body.contextMode === "personal" ? "personal" : "professional";
  const source = body.source === "share_extension" ? "share_extension" : "app";

  const [{ data: profile }, sharedContext] = await Promise.all([
    platformRepository
      .from("profiles")
      .select("safety_resource_region, first_login_complete, adult_us_eligibility_confirmed_at, adult_us_eligibility_version, terms_accepted_at, terms_version, privacy_acknowledged_at, privacy_version, coaching_disclaimer_acknowledged_at, coaching_disclaimer_version")
      .eq("id", user.id)
      .maybeSingle(),
    fetchSharedWebContext(platformRepository, user.id),
  ]);
  if (profile?.first_login_complete !== true || !hasCurrentBetaConsent(profile || {})) {
    return NextResponse.json({
      error: "Finish setting up your Beckett account before requesting coaching.",
      code: "mobile_account_setup_required",
    }, { status: 403 });
  }
  const safety = getSafetyResponse(
    [text, conversationContext, goal].filter(Boolean).join("\n"),
    profile?.safety_resource_region,
  );
  if (safety) {
    return NextResponse.json({
      error: safety.message,
      code: "mobile_safety_redirect",
      safety,
      result: null,
    }, { status: 422 });
  }

  const settings = {
    warmth: clean(body.settings?.warmth, 30) || "warm",
    directness: clean(body.settings?.directness, 30) || "balanced",
    formality: clean(body.settings?.formality, 30) || "natural",
    length: clean(body.settings?.length, 30) || "concise",
  };

  const system = [
    contextMode === "personal"
      ? "You are Beckett, a personalized communication coach for neurodivergent adults. This request concerns the user's personal life, not their workplace. Use natural everyday language and do not force workplace framing into the response."
      : "You are Beckett, a personalized workplace communication coach for neurodivergent adults.",
    contextModeInstruction(contextMode, action),
    actionInstruction(action),
    beckettBoundaryPrompt(),
    sharedContext.promptContext,
    mobileUserVoiceInstruction,
    "Match Beckett's web Message Help output: concise, practical, and easy to scan. Stay under 250 words total. Do not add an introduction, conclusion, unsolicited next steps, or an offer to help further.",
    mobileResultJsonInstruction(action),
  ].filter(Boolean).join("\n\n");
  const inputLabel = action === "respond"
    ? "Incoming message sent to the user. Write replies from the user's point of view; do not rewrite or paraphrase the incoming message"
    : action === "rewrite"
      ? "The user's draft to improve"
      : "Message to interpret";
  const prompt = [
    `Coaching settings: warmth ${settings.warmth}; directness ${settings.directness}; formality ${settings.formality}; length ${settings.length}.`,
    `${inputLabel}:\n${text}`,
    conversationContext ? `Surrounding conversation context:\n${conversationContext}` : null,
    person ? `Person or relationship:\n${person}` : null,
    goal ? `What the user wants to happen:\n${goal}` : null,
  ].filter(Boolean).join("\n\n");

  try {
    const usage = await metering.ai.record({
      userId: user.id,
      source: "ios",
      action: `mobile_${action}`,
      metadata: {
        platform: "ios",
        surface: source,
        resultContract: MOBILE_RESULT_CONTRACT_VERSION,
        retentionMode: privacy.retentionMode,
        contextMode,
      },
    });
    const generateResult = async (repair = false) => {
      const repairInstruction = repair
        ? `Your previous output contained missing or placeholder drafts. Return the same JSON shape again with exactly three complete messages in every option.text field.${action === "respond" ? " Each option must be a reply from the user to the incoming message—not a rewrite of what the sender said." : ""}`
        : null;
      const response = await callAnthropic(
        [system, repairInstruction].filter(Boolean).join("\n\n"),
        [{ role: "user", content: prompt }],
        900,
      );
      return normalizeMobileCoachResult(action, parseJsonObject<unknown>(response));
    };

    let result = await generateResult();
    if (!hasUsableMobileDraftOptions(result)) result = await generateResult(true);
    if (!hasUsableMobileDraftOptions(result)) {
      throw new Error("The model did not return complete draft options.");
    }

    return NextResponse.json({
      contractVersion: MOBILE_RESULT_CONTRACT_VERSION,
      requestId: crypto.randomUUID(),
      result,
      retention: {
        mode: privacy.retentionMode,
        contentSaved: false,
      },
      usage,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AiUsageLimitError) {
      return NextResponse.json({
        error: error.message,
        code: "mobile_usage_limit_reached",
        usage: { limit: error.limit, used: error.limit, remaining: 0, unlimited: false },
      }, { status: 429 });
    }
    return NextResponse.json({ error: "Beckett could not prepare coaching right now." }, { status: 502 });
  }
}
