import { NextRequest, NextResponse } from "next/server";
import { callAnthropic } from "@/lib/anthropic";
import { AiUsageLimitError } from "@/lib/ai-usage";
import { withAiMetering } from "@/lib/ai-metering";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/server-admin";
import { getMicrosoftMailMessage } from "@/lib/microsoft-oauth";
import { WebCreditLimitError } from "@/lib/web-credits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function displayAddress(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const address = (value as { emailAddress?: { name?: string; address?: string } }).emailAddress;
  return address?.name || address?.address || "";
}

function bodyText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const content = (value as { content?: unknown }).content;
  return typeof content === "string" ? content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

export async function POST(request: NextRequest) {
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const supabase = await createSupabaseServerClient();
  const { data: { user: cookieUser } } = await supabase.auth.getUser();
  const { data: { user: bearerUser } } = bearerToken ? await supabaseAdmin.auth.getUser(bearerToken) : { data: { user: null } };
  const user = cookieUser || bearerUser;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { messageId?: unknown; question?: unknown; content?: unknown; subject?: unknown; sender?: unknown };
  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
  const suppliedContent = typeof body.content === "string" ? body.content.trim().slice(0, 18_000) : "";
  if ((!messageId || messageId.length > 500) && !suppliedContent) return NextResponse.json({ error: "messageId or content is required" }, { status: 400 });
  try {
    const message = messageId ? await getMicrosoftMailMessage(user.id, messageId) as Record<string, unknown> | null : null;
    if (messageId && !message) return NextResponse.json({ error: "microsoft_not_connected" }, { status: 404 });
    const subject = typeof body.subject === "string" ? body.subject.slice(0, 500) : (typeof message?.subject === "string" ? message.subject : "(no subject)");
    const sender = typeof body.sender === "string" ? body.sender.slice(0, 500) : displayAddress(message?.from);
    const content = suppliedContent || bodyText(message?.body).slice(0, 18_000);
    if (!content) return NextResponse.json({ error: "message_body_unavailable" }, { status: 422 });
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 1000) : "";
    const metering = {
      userId: user.id,
      source: "outlook_addin",
      action: "decode_message",
      metadata: { platform: "outlook", input: messageId ? "microsoft_graph" : "office_js" },
    };
    const result = await withAiMetering(metering, () => callAnthropic(
      "You are Beckett, a private communication coach. Do not claim to know a sender's intent as fact. Separate visible evidence from possible interpretations, and give a practical next step. Never suggest sending a message automatically.",
      [{ role: "user", content: `Decode this user-selected Outlook message.\n\nSubject: ${subject}\nFrom: ${sender}\n${question ? `User question: ${question}\n` : ""}\nMessage:\n${content}\n\nReturn concise sections: Likely read, What it asks, and Possible next move.` }],
      650,
    ));
    return NextResponse.json({ result, message: { id: message?.id || null, subject, sender } });
  } catch (caught) {
    if (caught instanceof WebCreditLimitError) {
      return NextResponse.json({ error: caught.message, kind: caught.kind }, { status: caught.status });
    }
    if (caught instanceof AiUsageLimitError) {
      return NextResponse.json(
        {
          error: caught.message,
          limit: caught.limit,
          remaining: caught.remaining,
          unlimitedBypassConfigured: caught.unlimitedBypassConfigured,
        },
        { status: caught.status },
      );
    }
    const message = caught instanceof Error ? caught.message : "Microsoft message decode failed";
    const needsConsent = /permission|insufficient|scope|access denied|forbidden/i.test(message);
    return NextResponse.json({ error: needsConsent ? "microsoft_mail_consent_required" : message }, { status: needsConsent ? 403 : 502 });
  }
}
