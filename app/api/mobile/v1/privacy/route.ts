import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import {
  getMobilePrivacyPreferences,
  isMobileRetentionMode,
  mobilePrivacyDto,
  setMobilePrivacyPreferences,
} from "@/lib/mobile-consent";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const preferences = await getMobilePrivacyPreferences(user.id);
  return NextResponse.json({ privacy: mobilePrivacyDto(preferences) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: NextRequest) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    aiProcessingAllowed?: unknown;
    retentionMode?: unknown;
  } | null;
  if (typeof body?.aiProcessingAllowed !== "boolean" || !isMobileRetentionMode(body.retentionMode)) {
    return NextResponse.json({ error: "Choose both an AI-processing setting and a retention setting." }, { status: 400 });
  }

  try {
    const preferences = await setMobilePrivacyPreferences(user.id, {
      aiProcessingAllowed: body.aiProcessingAllowed,
      retentionMode: body.retentionMode,
    });
    return NextResponse.json({ privacy: mobilePrivacyDto(preferences) });
  } catch {
    return NextResponse.json({ error: "Beckett could not save those privacy choices." }, { status: 503 });
  }
}
