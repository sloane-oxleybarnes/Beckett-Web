import "server-only";

import { LoopsClient } from "loops";
import { supabaseAdmin } from "@/lib/server-admin";
import { decryptGoogleCredentialTokens } from "@/lib/google-token-security";

type ProfileRecord = {
  id: string;
  email: string | null;
  hubspot_contact_id: string | null;
  stripe_customer_id: string | null;
};

async function revokeGoogleTokens(storedToken: string | null | undefined) {
  for (const token of decryptGoogleCredentialTokens(storedToken)) {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    if (!response.ok && response.status !== 400) {
      throw new Error(`Google token revocation failed (${response.status}).`);
    }
  }
}

async function deleteHubSpotContact(contactId: string | null) {
  const key = process.env.HUBSPOT_API_KEY?.trim();
  if (!key || !contactId) return;
  const response = await fetch(`https://api.hubspot.com/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`HubSpot contact deletion failed (${response.status}).`);
  }
}

async function deleteLoopsContact(email: string | null) {
  const key = process.env.LOOPS_API_KEY?.trim();
  if (!key || !email) return;
  await new LoopsClient(key).deleteContact({ email });
}

async function deleteStripeCustomer(customerId: string | null) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !customerId) return;
  const response = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Stripe customer deletion failed (${response.status}).`);
  }
}

export async function deleteAccountData(userId: string) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, hubspot_contact_id, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle<ProfileRecord>();
  if (profileError) throw new Error(`Could not read profile for deletion: ${profileError.message}`);

  const email = profile?.email?.trim().toLowerCase() || null;
  const { data: integrations, error: integrationsError } = await supabaseAdmin
    .from("user_integrations")
    .select("provider, access_token")
    .eq("user_id", userId);
  if (integrationsError) throw new Error(`Could not read integrations for deletion: ${integrationsError.message}`);

  for (const integration of integrations || []) {
    if (integration.provider === "google" || integration.provider === "google_calendar") {
      await revokeGoogleTokens(integration.access_token);
    }
  }

  await Promise.all([
    deleteHubSpotContact(profile?.hubspot_contact_id || null),
    deleteLoopsContact(email),
    deleteStripeCustomer(profile?.stripe_customer_id || null),
  ]);

  // These relationships do not all cascade from auth.users, so clear them first.
  const cleanup = [
    supabaseAdmin.from("teams").update({ admin_id: null }).eq("admin_id", userId),
    supabaseAdmin.from("upgrade_intents").delete().eq("user_id", userId),
    supabaseAdmin.from("beta_events").delete().eq("user_id", userId),
    supabaseAdmin.from("site_content").update({ updated_by: null }).eq("updated_by", userId),
    supabaseAdmin.from("course_content").update({ updated_by: null }).eq("updated_by", userId),
    email ? supabaseAdmin.from("beta_signups").delete().eq("email", email) : Promise.resolve({ error: null }),
  ];
  const results = await Promise.all(cleanup);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Account data cleanup failed: ${failed.error.message}`);

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) throw new Error(`Auth account deletion failed: ${authError.message}`);

  const { error: profileDeleteError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (profileDeleteError) throw new Error(`Profile deletion failed: ${profileDeleteError.message}`);
}
