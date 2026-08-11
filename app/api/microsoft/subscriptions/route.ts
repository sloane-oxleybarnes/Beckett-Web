import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { microsoftGraphRequest, newMicrosoftClientState } from "@/lib/microsoft-oauth";
import { supabaseAdmin } from "@/lib/server-admin";

export const dynamic = "force-dynamic";

type Kind = "calendar" | "mail";
type Subscription = { id: string; kind: Kind; resource: string; expirationDateTime: string; clientState: string; lastNotificationAt?: string };

function normalizeKind(value: unknown): Kind | null {
  return value === "mail" || value === "calendar" ? value : null;
}

async function readMicrosoftMetadata(userId: string) {
  const { data, error } = await supabaseAdmin.from("user_integrations").select("metadata").eq("user_id", userId).eq("provider", "microsoft").maybeSingle();
  if (error) throw error;
  const metadata = data?.metadata && typeof data.metadata === "object" ? data.metadata as Record<string, unknown> : {};
  const subscriptions = Array.isArray(metadata.subscriptions) ? metadata.subscriptions.filter((value): value is Subscription => Boolean(value && typeof value === "object" && "id" in value && "kind" in value)) : [];
  return { metadata, subscriptions };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { subscriptions } = await readMicrosoftMetadata(user.id);
    return NextResponse.json({ subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      kind: subscription.kind,
      resource: subscription.resource,
      expirationDateTime: subscription.expirationDateTime,
      lastNotificationAt: subscription.lastNotificationAt,
    })) });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Could not load subscriptions" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { kind?: unknown; renewId?: unknown };
  const kind = normalizeKind(body.kind);
  try {
    const { metadata, subscriptions } = await readMicrosoftMetadata(user.id);
    if (typeof body.renewId === "string") {
      const existing = subscriptions.find((subscription) => subscription.id === body.renewId);
      if (!existing) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
      const expirationDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const renewed = await microsoftGraphRequest<Subscription>(user.id, `/subscriptions/${encodeURIComponent(existing.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expirationDateTime }) });
      const next = subscriptions.map((subscription) => subscription.id === existing.id ? { ...subscription, expirationDateTime: renewed?.expirationDateTime || expirationDateTime } : subscription);
      await supabaseAdmin.from("user_integrations").update({ metadata: { ...metadata, subscriptions: next }, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("provider", "microsoft");
      return NextResponse.json({ subscription: { id: existing.id, kind: existing.kind, resource: existing.resource, expirationDateTime: renewed?.expirationDateTime || expirationDateTime } });
    }
    if (!kind) return NextResponse.json({ error: "kind must be calendar or mail" }, { status: 400 });
    if (kind === "mail" && !String(metadata.scopes || "").split(" ").includes("Mail.Read")) return NextResponse.json({ error: "microsoft_mail_consent_required" }, { status: 403 });
    const existing = subscriptions.find((subscription) => subscription.kind === kind && Date.parse(subscription.expirationDateTime) > Date.now());
    if (existing) return NextResponse.json({ subscription: { id: existing.id, kind: existing.kind, resource: existing.resource, expirationDateTime: existing.expirationDateTime } });
    const expirationDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const resource = kind === "mail" ? "/me/mailFolders('inbox')/messages" : "/me/events";
    const clientState = newMicrosoftClientState();
    const notificationUrl = `${new URL(request.url).origin}/api/microsoft/webhooks`;
    const created = await microsoftGraphRequest<Subscription>(user.id, "/subscriptions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changeType: "created,updated,deleted", notificationUrl, resource, expirationDateTime, clientState }) });
    if (!created?.id) throw new Error("Microsoft did not return a subscription id");
    const subscription = { id: created.id, kind, resource, expirationDateTime: created.expirationDateTime || expirationDateTime, clientState };
    await supabaseAdmin.from("user_integrations").update({ metadata: { ...metadata, subscriptions: [...subscriptions, subscription] }, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("provider", "microsoft");
    return NextResponse.json({ subscription: { id: subscription.id, kind, resource, expirationDateTime: subscription.expirationDateTime } });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Could not create Microsoft subscription" }, { status: 502 });
  }
}
