import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

type Notification = { subscriptionId?: string; clientState?: string; changeType?: string; resource?: string };

export async function POST(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) return new NextResponse(validationToken, { status: 200, headers: { "content-type": "text/plain" } });
  const payload = await request.json().catch(() => ({})) as { value?: Notification[] };
  const notifications = Array.isArray(payload.value) ? payload.value : [];
  if (!notifications.length) return NextResponse.json({ received: true });
  const { data: integrations, error } = await supabaseAdmin.from("user_integrations").select("user_id,metadata").eq("provider", "microsoft");
  if (error) return NextResponse.json({ error: "Could not process notification" }, { status: 500 });
  for (const notification of notifications) {
    if (!notification.subscriptionId) continue;
    const match = (integrations || []).find((integration) => {
      const metadata = integration.metadata && typeof integration.metadata === "object" ? integration.metadata as Record<string, unknown> : {};
      const subscriptions = Array.isArray(metadata.subscriptions) ? metadata.subscriptions : [];
      return subscriptions.some((subscription) => subscription && typeof subscription === "object" && (subscription as { id?: unknown }).id === notification.subscriptionId && (subscription as { clientState?: unknown }).clientState === notification.clientState);
    });
    if (!match) continue;
    const metadata = match.metadata && typeof match.metadata === "object" ? match.metadata as Record<string, unknown> : {};
    const subscriptions = Array.isArray(metadata.subscriptions) ? metadata.subscriptions.map((subscription) => subscription && typeof subscription === "object" && (subscription as { id?: unknown }).id === notification.subscriptionId ? { ...(subscription as Record<string, unknown>), lastNotificationAt: new Date().toISOString() } : subscription) : [];
    await supabaseAdmin.from("user_integrations").update({ metadata: { ...metadata, subscriptions }, updated_at: new Date().toISOString() }).eq("user_id", match.user_id).eq("provider", "microsoft");
  }
  return NextResponse.json({ received: true });
}
