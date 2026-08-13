import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { microsoftGraphRequest, newMicrosoftClientState } from "@/lib/microsoft-oauth";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";

export const dynamic = "force-dynamic";

type Kind = "calendar" | "mail";
type GraphSubscription = { id?: string; resource?: string; expirationDateTime?: string };

function normalizeKind(value: unknown): Kind | null {
  return value === "mail" || value === "calendar" ? value : null;
}

function hashClientState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function requireMicrosoftUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireMicrosoftUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await integrationsRepository
    .from("microsoft_subscriptions")
    .select("id,kind,resource,expiration_at,last_notification_at")
    .eq("user_id", user.id)
    .order("expiration_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load subscriptions" }, { status: 500 });
  return NextResponse.json({ subscriptions: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await requireMicrosoftUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { kind?: unknown; renewId?: unknown };
  const kind = normalizeKind(body.kind);
  const expirationDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  try {
    if (typeof body.renewId === "string") {
      const { data: existing } = await integrationsRepository
        .from("microsoft_subscriptions")
        .select("id,kind,resource")
        .eq("id", body.renewId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existing) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

      const renewed = await microsoftGraphRequest<GraphSubscription>(user.id, `/subscriptions/${encodeURIComponent(existing.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expirationDateTime }),
      });
      const nextExpiration = renewed?.expirationDateTime || expirationDateTime;
      await integrationsRepository.from("microsoft_subscriptions").update({
        expiration_at: nextExpiration,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id).eq("user_id", user.id);
      return NextResponse.json({ subscription: { ...existing, expirationDateTime: nextExpiration } });
    }

    if (!kind) return NextResponse.json({ error: "kind must be calendar or mail" }, { status: 400 });
    const { data: integration } = await integrationsRepository
      .from("user_integrations")
      .select("metadata")
      .eq("user_id", user.id)
      .eq("provider", "microsoft")
      .maybeSingle();
    const metadata = integration?.metadata && typeof integration.metadata === "object"
      ? integration.metadata as Record<string, unknown>
      : {};
    const scopes = String(metadata.scopes || "").toLowerCase().split(/\s+/);
    if (kind === "mail" && !scopes.some((scope) => scope === "mail.read" || scope === "mail.readwrite")) {
      return NextResponse.json({ error: "microsoft_mail_consent_required" }, { status: 403 });
    }

    const { data: existing } = await integrationsRepository
      .from("microsoft_subscriptions")
      .select("id,kind,resource,expiration_at")
      .eq("user_id", user.id)
      .eq("kind", kind)
      .gt("expiration_at", new Date().toISOString())
      .maybeSingle();
    if (existing) return NextResponse.json({ subscription: existing });

    const resource = kind === "mail" ? "/me/mailFolders('inbox')/messages" : "/me/events";
    const clientState = newMicrosoftClientState();
    const notificationUrl = `${new URL(request.url).origin}/api/microsoft/webhooks`;
    const created = await microsoftGraphRequest<GraphSubscription>(user.id, "/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        changeType: "created,updated,deleted",
        notificationUrl,
        resource,
        expirationDateTime,
        clientState,
      }),
    });
    if (!created?.id) throw new Error("Microsoft did not return a subscription id");

    const nextExpiration = created.expirationDateTime || expirationDateTime;
    const { error } = await integrationsRepository.from("microsoft_subscriptions").insert({
      id: created.id,
      user_id: user.id,
      kind,
      resource: created.resource || resource,
      expiration_at: nextExpiration,
      client_state_hash: hashClientState(clientState),
    });
    if (error) throw error;
    return NextResponse.json({ subscription: { id: created.id, kind, resource, expirationDateTime: nextExpiration } });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Could not create Microsoft subscription" }, { status: 502 });
  }
}
