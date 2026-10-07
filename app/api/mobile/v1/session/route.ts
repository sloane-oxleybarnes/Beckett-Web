import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { getMobilePrivacyPreferences, mobilePrivacyDto } from "@/lib/mobile-consent";
import { platformRepository } from "@/lib/repositories/platform-repository";
import { hasCurrentBetaConsent } from "@/lib/beta-consent";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const [{ data: profile }, preferences] = await Promise.all([
    platformRepository
      .from("profiles")
      .select("display_name, first_name, full_name, plan, first_login_complete, adult_us_eligibility_confirmed_at, adult_us_eligibility_version, terms_accepted_at, terms_version, privacy_acknowledged_at, privacy_version, coaching_disclaimer_acknowledged_at, coaching_disclaimer_version")
      .eq("id", user.id)
      .maybeSingle(),
    getMobilePrivacyPreferences(user.id),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email || null,
      displayName: profile?.display_name || profile?.first_name || profile?.full_name || null,
      plan: profile?.plan || "free",
      onboardingComplete: profile?.first_login_complete === true && hasCurrentBetaConsent(profile || {}),
    },
    privacy: mobilePrivacyDto(preferences),
  }, { headers: { "Cache-Control": "no-store" } });
}
