import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOrUpdateHubSpotContact } from "@/lib/hubspot";
import { addLoopsContact, triggerLoopsEvent } from "@/lib/loops";
import { trackBetaEvent } from "@/lib/beta-events";
import { sendBetaSignupConfirmation, sendBetaSignupNotification } from "@/lib/beta-emails";
import {
  enforceRateLimit,
  hashRateLimitKey,
  rateLimitResponse,
  readJsonWithLimit,
  requestAddress,
} from "@/lib/security-rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE_PATTERN = /^[a-z0-9_-]{1,40}$/i;

export async function POST(req: NextRequest) {
  const ipLimit = enforceRateLimit(`beta-ip:${hashRateLimitKey(requestAddress(req))}`, 5, 60 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitResponse(ipLimit) },
    );
  }

  const body = await readJsonWithLimit<{ email?: unknown; name?: unknown; source?: unknown; plan?: unknown }>(req, 8_000);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const source = typeof body.source === "string" && SOURCE_PATTERN.test(body.source) ? body.source : "landing_page";
  const plan = body.plan === "beta" ? "beta" : null;

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!plan) return NextResponse.json({ error: "Unsupported plan." }, { status: 400 });

  const emailLimit = enforceRateLimit(`beta-email:${hashRateLimitKey(email)}`, 3, 24 * 60 * 60 * 1000);
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "This email has already requested access recently." },
      { status: 429, headers: rateLimitResponse(emailLimit) },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const now = new Date().toISOString();

  const { error } = await supabase.from("beta_signups").upsert({
    email,
    name: name || null,
    source,
    plan,
    lifecycle_stage: "requested_access",
    last_activity_at: now,
  }, { onConflict: "email" });
  if (error) return NextResponse.json({ error: "Could not save your request." }, { status: 503 });

  const hsId = await createOrUpdateHubSpotContact({
    email,
    firstname: name.split(" ")[0],
    lastname: name.split(" ").slice(1).join(" "),
    plan,
    source,
    properties: {
      beckett_beta_status: "requested_access",
      beckett_plan: plan,
      beckett_source: source,
      beckett_last_active_at: now,
    },
  });

  if (hsId) await supabase.from("beta_signups").update({ hubspot_contact_id: hsId }).eq("email", email);

  await addLoopsContact({ email, firstName: name.split(" ")[0], lastName: name.split(" ").slice(1).join(" "), plan, source });
  await triggerLoopsEvent(email, "beta_signup", { plan, source });
  await trackBetaEvent({ email, eventName: "beta_signup_requested", source, metadata: { plan, name: name || null } });

  try {
    await sendBetaSignupConfirmation({ email, name: name || null });
  } catch (error) {
    console.error("Resend signup confirmation error:", error instanceof Error ? error.message : "unknown");
  }

  try {
    await sendBetaSignupNotification({ email, name: name || null, source });
  } catch (error) {
    console.error("Resend beta signup notification error:", error instanceof Error ? error.message : "unknown");
  }

  return NextResponse.json({ success: true });
}
