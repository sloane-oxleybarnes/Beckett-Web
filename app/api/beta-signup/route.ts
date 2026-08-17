import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOrUpdateHubSpotContact } from "@/lib/hubspot";
import { addLoopsContact, triggerLoopsEvent } from "@/lib/loops";
import { trackBetaEvent } from "@/lib/beta-events";
import { sendBetaSignupConfirmation, sendBetaSignupNotification } from "@/lib/beta-emails";

export async function POST(req: NextRequest) {
  const { email, name, source, plan } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const sourceValue = source || "landing_page";
  const planValue = plan || "beta";
  const now = new Date().toISOString();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("beta_signups").upsert({
    email: normalizedEmail,
    name,
    source: sourceValue,
    plan: planValue,
    lifecycle_stage: "approved",
    approved: true,
    approved_at: now,
    last_activity_at: now,
  }, { onConflict: "email" });

  if (error && error.code !== "23505") {
    console.error("Supabase error:", error);
  }

  const hsId = await createOrUpdateHubSpotContact({
    email: normalizedEmail,
    firstname: name?.split(" ")[0],
    lastname: name?.split(" ").slice(1).join(" "),
    plan: planValue,
    source: sourceValue,
    properties: {
      beckett_beta_status: "approved",
      beckett_plan: planValue,
      beckett_source: sourceValue,
      beckett_approved_at: now,
      beckett_last_active_at: now,
    },
  });

  if (hsId) {
    await supabase
      .from("beta_signups")
      .update({ hubspot_contact_id: hsId })
      .eq("email", normalizedEmail);
  }

  await addLoopsContact({
    email: normalizedEmail,
    firstName: name?.split(" ")[0],
    lastName: name?.split(" ").slice(1).join(" "),
    plan: planValue,
    source: sourceValue,
  });

  await triggerLoopsEvent(normalizedEmail, "beta_signup", {
    plan: planValue,
    source: sourceValue,
  });

  await trackBetaEvent({
    email: normalizedEmail,
    eventName: "beta_signup_requested",
    source: sourceValue,
    metadata: { plan: planValue, name: name || null },
  });

  try {
    await sendBetaSignupConfirmation({
      email: normalizedEmail,
      name,
    });
  } catch (e) {
    console.error("Resend signup confirmation error:", e);
  }

  try {
    await sendBetaSignupNotification({
      email: normalizedEmail,
      name,
      source: sourceValue,
    });
  } catch (e) {
    console.error("Resend beta signup notification error:", e);
  }

  return NextResponse.json({ success: true });
}
