import { NextRequest, NextResponse } from "next/server";
import { mobileSessionDto, refreshMobileSession } from "@/lib/mobile-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { refreshToken?: unknown } | null;
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken.trim() : "";
  if (!refreshToken) return NextResponse.json({ error: "Refresh token required." }, { status: 400 });

  const { data, error } = await refreshMobileSession(refreshToken);
  if (error || !data.session) return NextResponse.json({ error: "Session expired." }, { status: 401 });
  return NextResponse.json({ session: mobileSessionDto(data.session) });
}
