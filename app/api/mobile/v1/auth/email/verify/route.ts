import { NextRequest, NextResponse } from "next/server";
import { mobileSessionDto, verifyMobileEmailCode } from "@/lib/mobile-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: unknown; code?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 320) : "";
  const code = typeof body?.code === "string" ? body.code.replace(/\s+/g, "").slice(0, 12) : "";
  if (!email || !/^\d{6,8}$/.test(code)) {
    return NextResponse.json({ error: "Enter the code Beckett emailed you." }, { status: 400 });
  }

  const { data, error } = await verifyMobileEmailCode(email, code);
  if (error || !data.session) {
    return NextResponse.json({ error: "That code is invalid or has expired." }, { status: 401 });
  }
  return NextResponse.json({ session: mobileSessionDto(data.session) });
}
