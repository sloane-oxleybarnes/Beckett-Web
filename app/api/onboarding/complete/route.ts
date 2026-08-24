import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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
import { trackBetaEvent } from "@/lib/beta-events";
import { addLoopsContact, triggerLoopsEvent, updateLoopsContact } from "@/lib/loops";
import { createOrUpdateHubSpotContact } from "@/lib/hubspot";
import {
  BETA_CONSENT_VERSIONS,
  hasRequiredBetaConsentSubmission,
  type BetaConsentSubmission,
} from "@/lib/beta-consent";
import { isConnectedAppId } from "@/lib/connected-apps";

type OnboardingBody = BetaConsentSubmission & {
  email?: string;
  full_name: string;
  first_name: string;
  last_name: string;
  display_name: string;
  communication_strength_ratings?: unknown;
  workplace_effort_ratings?: unknown;
  coaching_priority_ratings?: unknown;
  coaching_style_ratings?: unknown;
  neurodivergent_context?: string[];
  neurodivergent_context_other?: string | null;
  work_apps?: unknown[];
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as OnboardingBody;
  const now = new Date().toISOString();

  if (!hasRequiredBetaConsentSubmission(body)) {
    return NextResponse.json(
      { error: "Confirm beta eligibility and all required acknowledgements to continue." },
      { status: 400 }
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

  const legacyProfile = deriveLegacyCoachingProfile({
    strengthRatings,
    workplaceEffortRatings,
    coachingPriorityRatings,
    coachingStyleRatings,
  });

  const { error } = await platformRepository.from("profiles").upsert(
    {
      id: user.id,
      email: body.email || user.email,
      full_name: body.full_name,
      first_name: body.first_name,
      last_name: body.last_name,
      display_name: body.display_name,
      communication_strength_ratings: strengthRatings,
      workplace_effort_ratings: workplaceEffortRatings,
      coaching_priority_ratings: coachingPriorityRatings,
      coaching_style_ratings: coachingStyleRatings,
      strengths: legacyProfile.strengths,
      workplace_triggers: legacyProfile.workplaceTriggers,
      communication_preferences: legacyProfile.communicationPreferences,
      coaching_tone: legacyProfile.coachingTone,
      neurodivergent_context: body.neurodivergent_context || [],
      neurodivergent_context_other: body.neurodivergent_context_other || null,
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
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workApps = Array.isArray(body.work_apps) ? Array.from(new Set(body.work_apps.filter(isConnectedAppId))) : [];
  if (workApps.length) {
    const { error: appError } = await platformRepository.from("user_app_preferences").upsert(
      workApps.map((appId) => ({ user_id: user.id, app_id: appId, added_source: "onboarding", updated_at: now })),
      { onConflict: "user_id,app_id" },
    );
    if (appError) return NextResponse.json({ error: "Your profile was saved, but Your Apps could not be updated." }, { status: 500 });
  }

  const email = body.email || user.email || null;
  if (email) {
    await platformRepository
      .from("beta_signups")
      .update({ lifecycle_stage: "onboarded", last_activity_at: now })
      .eq("email", email.toLowerCase());

    await addLoopsContact({
      email,
      firstName: body.first_name,
      lastName: body.last_name,
      plan: "beta",
      source: "onboarding",
    });
    await updateLoopsContact(email, { onboarded: true });
    await triggerLoopsEvent(email, "onboarding_completed");
    await createOrUpdateHubSpotContact({
      email,
      firstname: body.first_name,
      lastname: body.last_name,
      plan: "beta",
      source: "onboarding",
    });
  }

  await trackBetaEvent({
    userId: user.id,
    email,
    eventName: "onboarding_completed",
    source: "web_app",
    metadata: {
      strengthsRatedCount: Object.keys(strengthRatings).length,
      workplaceEffortRatedCount: Object.keys(workplaceEffortRatings).length,
      coachingPrioritiesRatedCount: Object.keys(coachingPriorityRatings).length,
      coachingStylesRatedCount: Object.keys(coachingStyleRatings).length,
      neurodivergentContextCount: body.neurodivergent_context?.length || 0,
      workApps,
    },
  });

  return NextResponse.json({ ok: true });
}
