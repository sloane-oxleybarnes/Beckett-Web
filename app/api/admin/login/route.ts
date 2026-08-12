import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSession } from "@/lib/admin-session";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  (await cookies()).set("admin_auth", createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
