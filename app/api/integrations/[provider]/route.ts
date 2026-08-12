import { NextResponse } from "next/server";
import { trackBetaEvent } from "@/lib/beta-events";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const CONNECTED_PROVIDERS = ["google_workspace_addon", "google_calendar", "microsoft", "slack"] as const;
type ConnectedProvider = (typeof CONNECTED_PROVIDERS)[number];

function isConnectedProvider(value: string): value is ConnectedProvider {
  return CONNECTED_PROVIDERS.includes(value as ConnectedProvider);
}

async function revokeProviderToken(provider: ConnectedProvider, token: string) {
  try {
    if (provider === "microsoft" || provider === "google_workspace_addon") return;
    if (provider !== "slack") {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
      return;
    }

    await fetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Local removal is still enough to stop Beckett from accessing this provider.
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isConnectedProvider(provider)) {
    return NextResponse.json({ error: "Unsupported integration." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data: integration, error: readError } = await supabaseAdmin
    .from("user_integrations")
    .select("access_token, external_user_id, metadata")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: "Could not read the integration." }, { status: 500 });

  if (integration?.access_token) {
    await revokeProviderToken(provider, integration.access_token);
  }

  if (provider === "google_workspace_addon" && integration?.external_user_id) {
    const now = new Date().toISOString();
    const { error: disabledError } = await supabaseAdmin.from("user_integrations").upsert(
      {
        user_id: user.id,
        provider: "google_workspace_addon_disabled",
        external_user_id: integration.external_user_id,
        metadata: {
          email: integration.metadata && typeof integration.metadata === "object" && "email" in integration.metadata
            ? integration.metadata.email
            : null,
          source: "user_disconnected",
        },
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,provider" },
    );
    if (disabledError) return NextResponse.json({ error: "Could not disconnect the Gmail add-on." }, { status: 500 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (deleteError) return NextResponse.json({ error: "Could not disconnect the integration." }, { status: 500 });

  await trackBetaEvent({
    userId: user.id,
    email: user.email,
    eventName: `${provider}_disconnected`,
    source: "web_app",
  });

  return NextResponse.json({ ok: true });
}
