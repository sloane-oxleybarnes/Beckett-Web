import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";

export const dynamic = "force-dynamic";

type Notification = { subscriptionId?: string; clientState?: string };

function hashClientState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    if (validationToken.length > 512) return new NextResponse("Invalid validation token", { status: 400 });
    return new NextResponse(validationToken, { status: 200, headers: { "content-type": "text/plain" } });
  }

  const payload = await request.json().catch(() => ({})) as { value?: Notification[] };
  const notifications = Array.isArray(payload.value) ? payload.value.slice(0, 100) : [];
  const ids = Array.from(new Set(notifications.flatMap((item) =>
    typeof item.subscriptionId === "string" ? [item.subscriptionId] : []
  )));
  if (!ids.length) return NextResponse.json({ received: true });

  const { data: subscriptions, error } = await integrationsRepository
    .from("microsoft_subscriptions")
    .select("id,client_state_hash")
    .in("id", ids);
  if (error) return NextResponse.json({ error: "Could not process notification" }, { status: 500 });

  const hashes = new Map((subscriptions || []).map((item) => [item.id, item.client_state_hash]));
  const verifiedIds = Array.from(new Set(notifications.flatMap((item) => {
    if (!item.subscriptionId || !item.clientState) return [];
    return hashes.get(item.subscriptionId) === hashClientState(item.clientState) ? [item.subscriptionId] : [];
  })));
  if (verifiedIds.length) {
    await integrationsRepository.from("microsoft_subscriptions").update({
      last_notification_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).in("id", verifiedIds);
  }
  return NextResponse.json({ received: true });
}
