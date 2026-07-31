import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSession, adminCookieOptions } from "@/lib/admin-auth";
import { enforceRateLimit, hashRateLimitKey, rateLimitResponse, readJsonWithLimit, requestAddress } from "@/lib/security-rate-limit";

export async function POST(req: NextRequest) {
  const limit = enforceRateLimit(`admin-login:${hashRateLimitKey(requestAddress(req))}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: rateLimitResponse(limit) });

  const body = await readJsonWithLimit<{ password?: unknown }>(req, 4_000);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = createAdminSession();
  if (!session) return NextResponse.json({ error: "Admin authentication is not configured." }, { status: 503 });
  (await cookies()).set("admin_auth", session, adminCookieOptions());

  return NextResponse.json({ ok: true });
}
