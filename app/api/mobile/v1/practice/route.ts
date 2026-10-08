import { NextRequest, NextResponse } from "next/server";
import type {
  AdaptiveAssessment,
  AdaptiveSnapshot,
  AdaptiveState,
  AdaptiveTranscriptItem,
} from "@/lib/adaptive-conversation";
import { getMobileUser } from "@/lib/mobile-auth";
import { getMobilePrivacyPreferences, hasCurrentMobileAiConsent } from "@/lib/mobile-consent";
import {
  adaptiveAssessmentResponseFormat,
  assessmentInstructions,
  callAdaptiveModel,
  initialAdaptiveState,
  parseAdaptiveAssessment,
  parseAdaptiveTurn,
  turnInstructions,
} from "@/lib/openai-adaptive";
import { platformRepository } from "@/lib/repositories/platform-repository";
import { getSafetyResponse } from "@/lib/safety-resources";

export const dynamic = "force-dynamic";

type PracticeBody = {
  operation?: unknown;
  sessionId?: unknown;
  contextMode?: unknown;
  person?: unknown;
  situation?: unknown;
  goal?: unknown;
  concern?: unknown;
  relationshipContext?: unknown;
  personStyle?: unknown;
  constraints?: unknown;
  difficulty?: unknown;
  message?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function fallbackAssessment(transcript: AdaptiveTranscriptItem[]): AdaptiveAssessment {
  return {
    summary: "You completed the practice conversation. Review the exchange for moments that moved your goal forward and moments that created friction.",
    openingLine: null,
    whatWorked: transcript.length >= 2 ? ["You completed at least one full exchange."] : [],
    turningPoints: [],
    resistance: { increased: [], reduced: [] },
    goalProgress: "Use the transcript to identify what you want to keep and what you want to try differently next time.",
    replayPoint: null,
  };
}

async function requireConsent(userId: string) {
  const privacy = await getMobilePrivacyPreferences(userId);
  return hasCurrentMobileAiConsent(privacy);
}

export async function POST(request: NextRequest) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await requireConsent(user.id))) {
    return NextResponse.json({
      error: "Review how Beckett processes selected content before starting Practice.",
      code: "mobile_ai_consent_required",
    }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as PracticeBody | null;
  if (!body) return NextResponse.json({ error: "Add Practice details." }, { status: 400 });
  const operation = body.operation;

  if (operation === "start") {
    const person = clean(body.person, 160);
    const situation = clean(body.situation, 4_000);
    const goal = clean(body.goal, 1_000);
    if (!person || !situation || !goal) {
      return NextResponse.json({ error: "Add the person, situation, and goal." }, { status: 400 });
    }

    const { data: profile } = await platformRepository
      .from("profiles")
      .select("safety_resource_region")
      .eq("id", user.id)
      .maybeSingle();
    const safety = getSafetyResponse([situation, goal, clean(body.concern, 1_000)].join("\n"), profile?.safety_resource_region);
    if (safety) {
      return NextResponse.json({
        error: safety.message,
        code: "mobile_safety_redirect",
        safety,
      }, { status: 422 });
    }

    const contextMode = body.contextMode === "personal" ? "personal" : "professional";
    const relationshipContext = clean(body.relationshipContext, 1_000);
    const snapshot: AdaptiveSnapshot = {
      scenarioType: "general",
      channel: "text",
      difficulty: body.difficulty === "supportive"
        ? "supportive"
        : body.difficulty === "challenging"
          ? "challenging"
          : "realistic",
      contactId: null,
      person,
      situation,
      goal,
      concern: clean(body.concern, 1_000),
      relationshipContext: [
        `Conversation context: ${contextMode}.`,
        relationshipContext,
      ].filter(Boolean).join("\n"),
      personStyle: clean(body.personStyle, 1_000),
      constraints: clean(body.constraints, 1_000),
      approvedContactContext: "",
      voicePreference: "gender_neutral",
    };

    const { data, error } = await platformRepository
      .from("adaptive_conversation_sessions")
      .insert({
        user_id: user.id,
        contact_id: null,
        scenario_type: "general",
        channel: "text",
        difficulty: snapshot.difficulty,
        lifecycle: "ready",
        setup_snapshot: snapshot,
        simulation_state: initialAdaptiveState(snapshot),
        transcript: [],
        status: "active",
      })
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Practice could not start." }, { status: 500 });
    }
    return NextResponse.json({ sessionId: data.id, transcript: [] }, { status: 201 });
  }

  const sessionId = clean(body.sessionId, 80);
  if (!sessionId) return NextResponse.json({ error: "Practice session is required." }, { status: 400 });

  const { data: row, error: loadError } = await platformRepository
    .from("adaptive_conversation_sessions")
    .select("id,status,lifecycle,setup_snapshot,simulation_state,transcript,assessment")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  if (loadError || !row) return NextResponse.json({ error: "Practice session not found." }, { status: 404 });

  const snapshot = row.setup_snapshot as unknown as AdaptiveSnapshot;
  const state = row.simulation_state as unknown as AdaptiveState;
  const transcript = (Array.isArray(row.transcript) ? row.transcript : []) as unknown as AdaptiveTranscriptItem[];

  if (operation === "turn") {
    if (row.status !== "active") {
      return NextResponse.json({ error: "This Practice session has ended." }, { status: 409 });
    }
    const message = clean(body.message, 4_000);
    if (!message) return NextResponse.json({ error: "Add what you want to say." }, { status: 400 });
    if (transcript.length >= 40) {
      return NextResponse.json({ error: "This conversation has reached its turn limit." }, { status: 400 });
    }

    const history = transcript
      .map((item) => `${item.role === "user" ? "User" : snapshot.person}: ${item.content}`)
      .join("\n");
    const input = `${history ? `Conversation so far:\n${history}\n\n` : ""}User's latest message:\n${message}`;

    let result;
    try {
      result = parseAdaptiveTurn(await callAdaptiveModel(turnInstructions(snapshot, state), input, 700));
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "The simulated person could not respond.",
      }, { status: 502 });
    }

    const now = new Date().toISOString();
    const turn = transcript.filter((item) => item.role === "user").length + 1;
    const nextTranscript: AdaptiveTranscriptItem[] = [
      ...transcript,
      { role: "user", content: message, turn, createdAt: now },
      {
        role: "simulated_person",
        content: result.reply.trim(),
        turn,
        createdAt: now,
        stateAfter: result.state,
      },
    ];
    const { error } = await platformRepository
      .from("adaptive_conversation_sessions")
      .update({
        transcript: nextTranscript,
        simulation_state: result.state,
        lifecycle: "ready",
        updated_at: now,
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      transcript: nextTranscript,
      conversationStatus: result.conversationStatus,
      endReason: result.endReason,
    });
  }

  if (operation === "finish") {
    if (row.assessment) return NextResponse.json({ assessment: row.assessment });
    if (transcript.length < 2) {
      return NextResponse.json({ error: "Have at least one exchange before finishing." }, { status: 400 });
    }

    let assessment: AdaptiveAssessment;
    try {
      assessment = parseAdaptiveAssessment(await callAdaptiveModel(
        assessmentInstructions(snapshot, state),
        `Completed transcript:\n${JSON.stringify(transcript)}`,
        1_600,
        adaptiveAssessmentResponseFormat,
      ));
      assessment.replayPoint = null;
    } catch {
      assessment = fallbackAssessment(transcript);
    }

    const now = new Date().toISOString();
    const { error } = await platformRepository
      .from("adaptive_conversation_sessions")
      .update({
        assessment,
        status: "completed",
        lifecycle: "completed",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ assessment });
  }

  return NextResponse.json({ error: "Choose a supported Practice operation." }, { status: 400 });
}
