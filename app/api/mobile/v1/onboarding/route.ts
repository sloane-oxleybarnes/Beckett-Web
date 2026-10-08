import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { platformRepository } from "@/lib/repositories/platform-repository";
import {
  coachingPriorityRatingOptions,
  coachingStyleDimensions,
  coachingStyleRatingOptions,
  communicationPreferenceOptions,
  deriveLegacyCoachingProfile,
  hasCompleteRatingMap,
  normalizeRatingMap,
  strengthOptions,
  strengthRatingOptions,
  workplaceEffortRatingOptions,
  workplaceTriggerOptions,
} from "@/lib/onboarding";
import {
  BETA_CONSENT_VERSIONS,
  hasRequiredBetaConsentSubmission,
  type BetaConsentSubmission,
} from "@/lib/beta-consent";
import { trackBetaEvent } from "@/lib/beta-events";

export const dynamic = "force-dynamic";

type MobileOnboardingBody = BetaConsentSubmission & {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  communication_strength_ratings?: unknown;
  workplace_effort_ratings?: unknown;
  coaching_priority_ratings?: unknown;
  coaching_style_ratings?: unknown;
  neurodivergent_context?: string[];
  neurodivergent_context_other?: string | null;
};

export async function POST(request: NextRequest) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as MobileOnboardingBody | null;
  if (!body) {
    return NextResponse.json({ error: "Enter your setup details and try again." }, { status: 400 });
  }

  if (!hasRequiredBetaConsentSubmission(body)) {
    return NextResponse.json(
      { error: "Confirm beta eligibility and all required acknowledgements to continue." },
      { status: 400 },
    );
  }

  const firstName = body.first_name?.trim() || "";
  const lastName = body.last_name?.trim() || "";
  const displayName = body.display_name?.trim() || "";
  if (!firstName || !lastName || !displayName) {
    return NextResponse.json(
      { error: "Enter your first name, last name, and the name Beckett should use." },
      { status: 400 },
    );
  }

  const strengthRatings = normalizeRatingMap(
    body.communication_strength_ratings,
    strengthOptions,
    strengthRatingOptions.map((option) => option.value),
  );
  const workplaceEffortRatings = normalizeRatingMap(
    body.workplace_effort_ratings,
    workplaceTriggerOptions,
    workplaceEffortRatingOptions.map((option) => option.value),
  );
  const coachingPriorityRatings = normalizeRatingMap(
    body.coaching_priority_ratings,
    communicationPreferenceOptions,
    coachingPriorityRatingOptions.map((option) => option.value),
  );
  const coachingStyleRatings = normalizeRatingMap(
    body.coaching_style_ratings,
    coachingStyleDimensions.map((option) => option.id),
    coachingStyleRatingOptions.map((option) => option.value),
  );

  const ratingsComplete = hasCompleteRatingMap(strengthRatings, strengthOptions)
    && hasCompleteRatingMap(workplaceEffortRatings, workplaceTriggerOptions)
    && hasCompleteRatingMap(coachingPriorityRatings, communicationPreferenceOptions)
    && hasCompleteRatingMap(coachingStyleRatings, coachingStyleDimensions.map((option) => option.id));

  if (!ratingsComplete) {
    return NextResponse.json(
      { error: "Rate every communication and coaching category before continuing." },
      { status: 400 },
    );
  }

  const context = Array.isArray(body.neurodivergent_context)
    ? body.neurodivergent_context.filter((value): value is string => typeof value === "string")
    : [];
  const legacyProfile = deriveLegacyCoachingProfile({
    strengthRatings,
    workplaceEffortRatings,
    coachingPriorityRatings,
    coachingStyleRatings,
  });
  const now = new Date().toISOString();
  const fullName = `${firstName} ${lastName}`;

  const { error } = await platformRepository.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      communication_strength_ratings: strengthRatings,
      workplace_effort_ratings: workplaceEffortRatings,
      coaching_priority_ratings: coachingPriorityRatings,
      coaching_style_ratings: coachingStyleRatings,
      strengths: legacyProfile.strengths,
      workplace_triggers: legacyProfile.workplaceTriggers,
      communication_preferences: legacyProfile.communicationPreferences,
      coaching_tone: legacyProfile.coachingTone,
      neurodivergent_context: context,
      neurodivergent_context_other: body.neurodivergent_context_other?.trim() || null,
      adult_us_eligibility_confirmed_at: now,
      adult_us_eligibility_version: BETA_CONSENT_VERSIONS.eligibility,
      terms_accepted_at: now,
      terms_version: BETA_CONSENT_VERSIONS.terms,
      privacy_acknowledged_at: now,
      privacy_version: BETA_CONSENT_VERSIONS.privacy,
      coaching_disclaimer_acknowledged_at: now,
      coaching_disclaimer_version: BETA_CONSENT_VERSIONS.coachingDisclaimer,
      first_login_complete: true,
      onboarding_completed_at: now,
      updated_at: now,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Mobile onboarding profile update failed", error);
    return NextResponse.json({ error: "Beckett could not save your setup. Please try again." }, { status: 500 });
  }

  if (user.email) {
    await platformRepository
      .from("beta_signups")
      .update({ lifecycle_stage: "onboarded", last_activity_at: now })
      .eq("email", user.email.toLowerCase());
  }

  await trackBetaEvent({
    userId: user.id,
    email: user.email || null,
    eventName: "onboarding_completed",
    source: "ios_app",
    metadata: {
      strengthsRatedCount: Object.keys(strengthRatings).length,
      workplaceEffortRatedCount: Object.keys(workplaceEffortRatings).length,
      coachingPrioritiesRatedCount: Object.keys(coachingPriorityRatings).length,
      coachingStylesRatedCount: Object.keys(coachingStyleRatings).length,
      neurodivergentContextCount: context.length,
    },
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
