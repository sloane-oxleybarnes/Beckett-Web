import { NextRequest, NextResponse } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError } from "@/lib/ai-usage";
import { metering } from "@/lib/metering";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSafetyResponse } from "@/lib/safety-resources";
import { fetchSharedWebContext } from "@/lib/shared-web-context";
import { isMessageHelpAction, messageHelpTask, type MessageHelpAction } from "@/lib/message-help";

type Action = MessageHelpAction | "draft";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as { action?: unknown; text?: unknown; context?: unknown; conversationContext?: unknown; person?: unknown; goal?: unknown; warmth?: unknown; directness?: unknown; formality?: unknown; length?: unknown } | null;
  const action = isMessageHelpAction(body?.action) || body?.action === "draft" ? body.action as Action : null;
  const canonicalAction: MessageHelpAction | null = action === "draft" ? "respond" : action;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const context = typeof body?.context === "string" ? body.context.trim().slice(0, 1500) : "";
  const conversationContext = typeof body?.conversationContext === "string" ? body.conversationContext.trim().slice(0, 6000) : "";
  const person = typeof body?.person === "string" ? body.person.trim().slice(0, 120) : "";
  const goal = typeof body?.goal === "string" ? body.goal.trim().slice(0, 500) : "";
  if (!canonicalAction || !text || text.length > 5000) return NextResponse.json({ error: "Choose an action and add up to 5,000 characters." }, { status: 400 });

  const [{ data: profile }, sharedContext] = await Promise.all([
    supabase.from("profiles").select("safety_resource_region").eq("id", user.id).maybeSingle(),
    fetchSharedWebContext(supabase, user.id),
  ]);
  const safety = getSafetyResponse([text, conversationContext, context, goal].filter(Boolean).join("\n"), profile?.safety_resource_region);
  if (safety) return NextResponse.json({ safety, response: null });

  const warmth = typeof body?.warmth === "string" ? body.warmth.slice(0, 30) : "warm";
  const directness = typeof body?.directness === "string" ? body.directness.slice(0, 30) : "balanced";
  const formality = typeof body?.formality === "string" ? body.formality.slice(0, 30) : "natural";
  const length = typeof body?.length === "string" ? body.length.slice(0, 30) : "concise";
  const task = messageHelpTask(canonicalAction);
  const system = `You are Beckett, a personalized communication coach for neurodivergent adults. ${task}\n\n${beckettBoundaryPrompt()}\n\n${sharedContext.promptContext}\n\nDo not diagnose people or infer hidden intent as fact. Be practical, respectful, and under 350 words.`;
  const prompt = `Communication settings: directness ${directness}; warmth ${warmth}; formality ${formality}; length ${length}.\n\nSpecific message, draft, or situation to focus on:\n${text}${conversationContext ? `\n\nSurrounding conversation context (use this to understand the specific message above; do not treat every line as the target message):\n${conversationContext}` : ""}${person ? `\n\nPerson or relationship:\n${person}` : ""}${context ? `\n\nOptional context supplied by the user:\n${context}` : ""}${goal ? `\n\nWhat the user wants to happen:\n${goal}` : ""}`;

  try {
    await metering.ai.record({ userId: user.id, source: "web_coach", action: `coach_${canonicalAction}`, metadata: { directness, warmth, formality, length } });
    const response = await callAnthropic(system, [{ role: "user", content: prompt }], 900);
    return NextResponse.json({ response: response.trim(), safety: null });
  } catch (error) {
    if (error instanceof AiUsageLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Beckett could not prepare coaching right now." }, { status: 502 });
  }
}
