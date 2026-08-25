import { NextRequest, NextResponse } from "next/server";
import { callAnthropic, type AnthropicContentBlock } from "@/lib/anthropic";
import { AiUsageLimitError } from "@/lib/ai-usage";
import { metering } from "@/lib/metering";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"] as const);

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a screenshot to upload." }, { status: 400 });
  if (!IMAGE_TYPES.has(file.type as typeof IMAGE_TYPES extends Set<infer T> ? T : never) || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Screenshots must be PNG, JPG, or WebP images smaller than 10 MB." }, { status: 400 });
  }

  try {
    const imageData = Buffer.from(await file.arrayBuffer()).toString("base64");
    const content: AnthropicContentBlock[] = [
      { type: "image", source: { type: "base64", media_type: file.type as "image/png" | "image/jpeg" | "image/webp", data: imageData } },
      { type: "text", text: "Transcribe the workplace message or conversation shown in this screenshot. Preserve wording, punctuation, line breaks, names, and timestamps when legible. Return only the transcription, with no commentary or interpretation. If text is unreadable, transcribe what is legible and mark uncertain words with [unclear]." },
    ];
    await metering.ai.record({ userId: user.id, source: "web_coach", action: "message_help_attachment", metadata: { mimeType: file.type, size: file.size } });
    const response = await callAnthropic(
      "You are Beckett, a careful workplace communication coach. Your task in this request is transcription only. Never invent missing text or infer the meaning of a message.",
      [{ role: "user", content }],
      900,
    );
    const extractedText = response.trim().slice(0, 5000);
    if (!extractedText) return NextResponse.json({ error: "Beckett could not read text in that screenshot." }, { status: 422 });
    return NextResponse.json({ extractedText });
  } catch (error) {
    if (error instanceof AiUsageLimitError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Message help attachment processing failed", error);
    return NextResponse.json({ error: "Beckett could not read that screenshot. Try a clearer image." }, { status: 502 });
  }
}
