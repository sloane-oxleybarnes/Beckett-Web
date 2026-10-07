import { NextRequest, NextResponse } from "next/server";
import { requestMobileEmailCode } from "@/lib/mobile-auth";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 320) : "";
  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { error } = await requestMobileEmailCode(email);
  if (error) {
    return NextResponse.json({ error: "Beckett could not send a sign-in code right now." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
