import { NextRequest, NextResponse } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError } from "@/lib/ai-usage";
import { metering } from "@/lib/metering";
import { beckettBoundaryPrompt } from "@/lib/beckett-boundaries";
import { getOutlookAddinUser, hasUnlinkedMicrosoftAccount } from "@/lib/outlook-addin-auth";

export const dynamic = "force-dynamic";

type ThreadMessage = { sender?: unknown; subject?: unknown; body?: unknown; sentAt?: unknown };

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
  const user = await getOutlookAddinUser(request);
  if (!user) {
    const needsMicrosoftConnection = await hasUnlinkedMicrosoftAccount(request);
    return NextResponse.json(
      needsMicrosoftConnection
        ? { error: "Link this Microsoft work account to your Beckett profile to analyze messages.", needsMicrosoftConnection: true }
        : { error: "Unauthorized." },
      { status: needsMicrosoftConnection ? 403 : 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as { content?: unknown; subject?: unknown; sender?: unknown; thread?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim().slice(0, 12_000) : "";
  const thread = Array.isArray(body?.thread)
    ? body.thread.slice(-12).map((message: ThreadMessage) => ({
      sender: typeof message.sender === "string" ? message.sender.trim().slice(0, 300) : "Unknown sender",
      subject: typeof message.subject === "string" ? message.subject.trim().slice(0, 500) : "(no subject)",
      body: typeof message.body === "string" ? message.body.trim().slice(0, 4_000) : "",
      sentAt: typeof message.sentAt === "string" ? message.sentAt : null,
    })).filter((message) => message.body)
    : [];
  if (!content && !thread.length) return NextResponse.json({ error: "Choose an Outlook message or draft first." }, { status: 400 });
  const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 500) : "(no subject)";
  const sender = typeof body?.sender === "string" ? body.sender.trim().slice(0, 500) : "Unknown sender";

  try {
    await metering.ai.record({ userId: user.id, source: "outlook_addin", action: "decode_selected_item" });
    const result = await callAnthropic(
      `You are Beckett, a private communication coach. Explain only what the selected text supports, state uncertainty clearly, and never claim to know the sender's hidden intent. Never send or save a message.\n\n${beckettBoundaryPrompt()}`,
      [{ role: "user", content: `Analyze this user-selected Outlook ${thread.length ? "conversation" : "message"}.\n\n${thread.length ? `Full conversation, oldest to newest:\n${thread.map((message) => `[${message.sentAt || "unknown time"}] ${message.sender}: ${message.body}`).join("\n\n")}` : `Subject: ${subject}\nFrom: ${sender}\n\nMessage:\n${content}`}\n\nOnly use the visible content. Keep every field concise and scannable. Respond ONLY with valid JSON, no markdown:\n{\n  "intent": "what the sender likely means or wants",\n  "tone": "the emotional tone, stated with appropriate uncertainty",\n  "want": "what the sender likely wants the user to do or say next",\n  "responses": [\n    { "label": "Direct and clear", "tag": "direct", "text": "ready-to-send reply, max 35 words" },\n    { "label": "Warm and collaborative", "tag": "warm", "text": "ready-to-send reply, max 35 words" },\n    { "label": "Sets a gentle limit", "tag": "boundary", "text": "ready-to-send reply, max 35 words" }\n  ]\n}` }],
      650,
    );
    return NextResponse.json({ result: parseAnalysis(result) });
  } catch (error) {
    if (error instanceof AiUsageLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Beckett could not decode this item right now." }, { status: 502 });
  }
}
