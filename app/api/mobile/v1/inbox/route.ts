import { NextRequest, NextResponse } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError } from "@/lib/ai-usage";
import { hasCurrentBetaConsent } from "@/lib/beta-consent";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { getMobileUser } from "@/lib/mobile-auth";
import { getMobilePrivacyPreferences, hasCurrentMobileAiConsent } from "@/lib/mobile-consent";
import { mobileUserVoiceInstruction } from "@/lib/mobile-result-contracts";
import { metering } from "@/lib/metering";
import { platformRepository } from "@/lib/repositories/platform-repository";
import { getSafetyResponse } from "@/lib/safety-resources";
import { fetchSharedWebContext } from "@/lib/shared-web-context";

export const dynamic = "force-dynamic";

type InboxBody = {
  contextMode?: unknown;
  action?: unknown;
  originalMessage?: unknown;
  initialCoaching?: unknown;
  person?: unknown;
  goal?: unknown;
  conversationContext?: unknown;
  messages?: unknown;
  message?: unknown;
};

type InboxTurn = { role: "user" | "assistant"; content: string };

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanTurns(value: unknown): InboxTurn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap((item): InboxTurn[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
    const content = clean(record.content, 2_000);
    return role && content ? [{ role, content }] : [];
  });
}

function conversationText(turns: InboxTurn[]) {
  return turns.map((turn) => `${turn.role === "user" ? "User" : "Beckett"}: ${turn.content}`).join("\n\n");
}

export async function POST(request: NextRequest) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as InboxBody | null;
  const message = clean(body?.message, 4_000);
  if (!message) return NextResponse.json({ error: "Add a follow-up question." }, { status: 400 });

  const privacy = await getMobilePrivacyPreferences(user.id);
  if (!hasCurrentMobileAiConsent(privacy)) {
    return NextResponse.json({
      error: "Review how Beckett processes selected content before continuing the conversation.",
      code: "mobile_ai_consent_required",
    }, { status: 403 });
  }

  const originalMessage = clean(body?.originalMessage, 12_000);
  const initialCoaching = clean(body?.initialCoaching, 8_000);
  const person = clean(body?.person, 160);
  const goal = clean(body?.goal, 1_000);
  const context = clean(body?.conversationContext, 4_000);
  const turns = cleanTurns(body?.messages);
  const contextMode = body?.contextMode === "personal" ? "personal" : "professional";
  const action = ["decode", "respond", "rewrite"].includes(String(body?.action))
    ? String(body?.action)
    : "decode";

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
      error: "Finish setting up your Beckett account before continuing the conversation.",
      code: "mobile_account_setup_required",
    }, { status: 403 });
  }

  const safety = getSafetyResponse(
    [originalMessage, context, goal, conversationText(turns), message].filter(Boolean).join("\n"),
    profile?.safety_resource_region,
  );
  if (safety) {
    return NextResponse.json({
      error: safety.message,
      code: "mobile_safety_redirect",
      safety,
    }, { status: 422 });
  }

  const system = [
    contextMode === "personal"
      ? "You are Beckett, a personalized communication coach helping with a personal conversation."
      : "You are Beckett, a personalized workplace communication coach.",
    "Continue an existing coaching conversation. Answer the user's latest follow-up using the original message, prior coaching, and conversation so far. Be warm, concrete, and direct. If they ask for wording, provide one concise ready-to-use draft. If important context is missing, ask at most one focused question. Do not repeat the full prior analysis.",
    beckettBoundaryPrompt(),
    sharedContext.promptContext,
    mobileUserVoiceInstruction,
    "Stay under 180 words. Use short paragraphs or bullets when useful. Do not add an unsolicited offer to help further. Never claim a message was sent. Return plain text only.",
  ].filter(Boolean).join("\n\n");

  const prompt = [
    `Context lens: ${contextMode}. Initial action: ${action}.`,
    originalMessage ? `Original message or draft:\n${originalMessage}` : null,
    initialCoaching ? `Beckett's initial coaching:\n${initialCoaching}` : null,
    person ? `Person or relationship: ${person}` : null,
    goal ? `User's goal: ${goal}` : null,
    context ? `Surrounding context:\n${context}` : null,
    turns.length ? `Follow-up conversation so far:\n${conversationText(turns)}` : null,
    `User's latest follow-up:\n${message}`,
  ].filter(Boolean).join("\n\n");

  try {
    const usage = await metering.ai.record({
      userId: user.id,
      source: "ios",
      action: "mobile_inbox_follow_up",
      metadata: {
        platform: "ios",
        surface: "inbox",
        retentionMode: privacy.retentionMode,
        contextMode,
        initialAction: action,
        priorTurnCount: turns.length,
      },
    });
    const reply = clean(await callAnthropic(system, [{ role: "user", content: prompt }], 600), 2_000);
    if (!reply) throw new Error("Empty coaching response.");
    return NextResponse.json({
      requestId: crypto.randomUUID(),
      reply,
      retention: { mode: privacy.retentionMode, contentSaved: false },
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
    return NextResponse.json({ error: "Beckett could not continue the conversation right now." }, { status: 502 });
  }
}
