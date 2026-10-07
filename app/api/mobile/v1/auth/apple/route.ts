import { NextRequest, NextResponse } from "next/server";
import { mobileSessionDto, signInMobileWithApple } from "@/lib/mobile-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { identityToken?: unknown; nonce?: unknown } | null;
  const identityToken = typeof body?.identityToken === "string" ? body.identityToken.trim() : "";
  const nonce = typeof body?.nonce === "string" ? body.nonce.trim().slice(0, 200) : "";
  if (!identityToken || !nonce) {
    return NextResponse.json({ error: "Apple sign-in information is incomplete." }, { status: 400 });
  }

  const { data, error } = await signInMobileWithApple(identityToken, nonce);
  if (error || !data.session) {
    return NextResponse.json({ error: "Beckett could not complete Sign in with Apple." }, { status: 401 });
  }
  return NextResponse.json({ session: mobileSessionDto(data.session) });
}
