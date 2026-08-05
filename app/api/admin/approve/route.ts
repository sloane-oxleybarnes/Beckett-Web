import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { trackBetaEvent } from "@/lib/beta-events";
import { triggerLoopsEvent } from "@/lib/loops";
import { sendBetaAccessReadyEmail, sendBetaInviteEmail } from "@/lib/beta-emails";
import { verifyAdminSession } from "@/lib/admin-session";
import { findAuthUserByEmail } from "@/lib/admin-beta-approval";

function buildPasswordSetupLink(origin: string, tokenHash: string, type: "invite" | "recovery") {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("next", "/auth/set-password");
  return url.toString();
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  if (!verifyAdminSession(cookieStore.get("admin_auth")?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, id } = await req.json();
  if (!email || !id) {
    return NextResponse.json({ error: "email and id required" }, { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://meetbeckett.co'
  const { data: signup, error: signupError } = await supabase
    .from("beta_signups")
    .select("name, email, approved")
    .eq("id", id)
    .maybeSingle();

  if (signupError) {
    return NextResponse.json({ error: signupError.message }, { status: 500 });
  }
  if (!signup || signup.email.trim().toLowerCase() !== normalizedEmail) {
    return NextResponse.json({ error: "Beta signup not found." }, { status: 404 });
  }

  let existingAuthUser;
  try {
    existingAuthUser = await findAuthUserByEmail(supabase.auth.admin, normalizedEmail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not check the existing account." },
      { status: 500 }
    );
  }

  // The Auth before-user-created hook checks this approved flag. Persist it
  // before asking Supabase to create a legitimate invited account.
  const now = new Date().toISOString();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ plan: "beta" })
    .eq("email", normalizedEmail);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: approvalError } = await supabase
    .from("beta_signups")
    .update({
      approved: true,
      approved_at: now,
      invite_sent_at: now,
      lifecycle_stage: existingAuthUser?.last_sign_in_at ? "account_created" : "invited",
      last_activity_at: now,
      ...(existingAuthUser ? { invite_reminder_sent_at: now } : {}),
    })
    .eq("id", id);

  if (approvalError) {
    return NextResponse.json({ error: approvalError.message }, { status: 500 });
  }

  let emailWarning: string | null = null;
  try {
    if (existingAuthUser && process.env.RESEND_API_KEY) {
      await sendBetaAccessReadyEmail({
        email: normalizedEmail,
        name: signup.name,
        loginUrl: `${origin}/auth/login?next=${encodeURIComponent("/auth/profile-setup")}`,
      });
    } else if (existingAuthUser) {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`,
        }
      );
      if (recoveryError) throw recoveryError;
    } else if (process.env.RESEND_API_KEY) {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          redirectTo: `${origin}/auth/callback`,
          data: { plan: "beta" },
        },
      });
      if (linkError || !linkData.properties?.action_link) {
        throw new Error(linkError?.message || "Could not generate invite link.");
      }

      const actionLink = linkData.properties.hashed_token
        ? buildPasswordSetupLink(origin, linkData.properties.hashed_token, "invite")
        : linkData.properties.action_link;
      await sendBetaInviteEmail({
        email: normalizedEmail,
        name: signup.name,
        actionLink,
      });
    } else {
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        normalizedEmail,
        {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`,
          data: { plan: "beta" },
        }
      );
      if (inviteError) throw inviteError;
    }
  } catch (error) {
    emailWarning =
      error instanceof Error
        ? `Access was approved, but the invitation could not be sent: ${error.message}`
        : "Access was approved, but the invitation could not be sent.";
    console.error(emailWarning);
  }

  await triggerLoopsEvent(normalizedEmail, "beta_invite_sent");
  await trackBetaEvent({
    email: normalizedEmail,
    eventName: "beta_invite_sent",
    source: "admin",
    metadata: { signupId: id, existingAccount: Boolean(existingAuthUser) },
  });

  return NextResponse.json({
    ok: true,
    existingAccount: Boolean(existingAuthUser),
    warning: emailWarning,
  });
}
