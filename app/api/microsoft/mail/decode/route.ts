import { NextRequest, NextResponse } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError, recordAiUsage } from "@/lib/ai-usage";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

function parseAnalysis(text: string) {
  const trimmed = text.trim();
  const candidate = trimmed.match(/\{[\s\S]*\}/)?.[0] || trimmed;
  return JSON.parse(candidate) as {
    intent?: string;
    tone?: string;
    want?: string;
    responses?: Array<{ label?: string; tag?: string; text?: string }>;
  };
}

export async function POST(request: NextRequest) {
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const supabase = createSupabaseServerClient();
  const { data: { user: cookieUser } } = await supabase.auth.getUser();
  const { data: { user: bearerUser } } = bearerToken ? await supabaseAdmin.auth.getUser(bearerToken) : { data: { user: null } };
  const user = cookieUser || bearerUser;
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { content?: unknown; subject?: unknown; sender?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 12_000) : "";
  if (!content) return NextResponse.json({ error: "Choose an Outlook message or draft first." }, { status: 400 });
  const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 500) : "(no subject)";
  const sender = typeof body?.sender === "string" ? body.sender.trim().slice(0, 500) : "Unknown sender";

  try {
    await recordAiUsage(user.id, { source: "outlook_addin", action: "decode_selected_item" });
    const result = await callAnthropic(
      `You are Beckett, a private communication coach. Explain only what the selected text supports, state uncertainty clearly, and never claim to know the sender's hidden intent. Never send or save a message.\n\n${beckettBoundaryPrompt()}`,
      [{ role: "user", content: `Analyze this user-selected Outlook message.\n\nSubject: ${subject}\nFrom: ${sender}\n\nMessage:\n${content}\n\nRespond ONLY with valid JSON, no markdown:\n{\n  "intent": "what the sender likely means or wants",\n  "tone": "the emotional tone, stated with appropriate uncertainty",\n  "want": "what the sender likely wants the user to do or say next",\n  "responses": [\n    { "label": "Direct and clear", "tag": "direct", "text": "ready-to-send reply, max 35 words" },\n    { "label": "Warm and collaborative", "tag": "warm", "text": "ready-to-send reply, max 35 words" },\n    { "label": "Sets a gentle limit", "tag": "boundary", "text": "ready-to-send reply, max 35 words" }\n  ]\n}` }],
      650,
    );
    return NextResponse.json({ result: parseAnalysis(result) });
  } catch (error) {
    if (error instanceof AiUsageLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Beckett could not decode this item right now." }, { status: 502 });
  }
}
