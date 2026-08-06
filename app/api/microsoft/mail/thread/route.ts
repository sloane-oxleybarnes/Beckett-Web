import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftMessageThread, microsoftNeedsReconnect } from "@/lib/microsoft-oauth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

async function authenticatedUser(request: NextRequest) {
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const supabase = createSupabaseServerClient();
  const { data: { user: cookieUser } } = await supabase.auth.getUser();
  const { data: { user: bearerUser } } = bearerToken
    ? await supabaseAdmin.auth.getUser(bearerToken)
    : { data: { user: null } };
  return cookieUser || bearerUser;
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { itemId?: unknown } | null;
  const itemId = typeof body?.itemId === "string" ? body.itemId.trim().slice(0, 4_000) : "";
  if (!itemId) return NextResponse.json({ error: "Open a specific message in this conversation first." }, { status: 400 });

  try {
    const thread = await getMicrosoftMessageThread(user.id, itemId);
    if (!thread.length) return NextResponse.json({ error: "No readable messages were found in this conversation." }, { status: 404 });
    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof Error && error.name === "MicrosoftMailPermissionError") {
      return NextResponse.json({ error: "Connect Microsoft 365 with mail permission before analyzing a full thread.", needsMicrosoftConnection: true }, { status: 409 });
    }
    if (microsoftNeedsReconnect(error)) {
      return NextResponse.json({ error: "Reconnect Microsoft 365, then try the full-thread analysis again.", needsMicrosoftConnection: true }, { status: 409 });
    }
    return NextResponse.json({ error: "Beckett could not load this Outlook conversation." }, { status: 502 });
  }
}
