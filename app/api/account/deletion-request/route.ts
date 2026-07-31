import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { deleteAccountData } from "@/lib/account-deletion";
import { enforceRateLimit, hashRateLimitKey, rateLimitResponse, readJsonWithLimit } from "@/lib/security-rate-limit";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = enforceRateLimit(`account-delete:${hashRateLimitKey(user.id)}`, 2, 24 * 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Deletion has already been requested recently." }, { status: 429, headers: rateLimitResponse(limit) });
  }

  const body = (await readJsonWithLimit<{ notes?: unknown }>(req, 8_000)) || {};
  const requestedAt = new Date().toISOString();
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1_000) || null : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      deletion_requested_at: requestedAt,
      deletion_status: "requested",
      deletion_notes: notes,
      updated_at: requestedAt,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await deleteAccountData(user.id);
  } catch (deletionError) {
    console.error("Account deletion failed:", deletionError);
    await supabase
      .from("profiles")
      .update({ deletion_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return NextResponse.json({ error: "Account deletion could not be completed. Please contact support." }, { status: 500 });
  }

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails
      .send({
        from: "Beckett <hello@meetbeckett.co>",
        to: "hello@meetbeckett.co",
        subject: "Account deletion completed",
        text: [
          "A Beckett beta user completed account deletion.",
          `Email: ${user.email || "unknown"}`,
          `User ID: ${user.id}`,
          `Requested at: ${requestedAt}`,
          notes ? `Notes: ${notes}` : null,
        ].filter(Boolean).join("\n"),
        html: `
          <p>A Beckett beta user requested account deletion.</p>
          <p><strong>Account deletion completed.</strong></p>
        `,
      })
      .catch((emailError) => {
        console.error("Deletion request email error:", emailError);
      });
  }

  return NextResponse.json({ ok: true, deleted_at: requestedAt });
}
