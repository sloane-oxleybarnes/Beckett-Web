"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { hasCurrentBetaConsent } from "@/lib/beta-consent";
import {
  coachingPriorityRatingOptions,
  coachingStyleDimensions,
  coachingStyleRatingOptions,
  communicationPreferenceOptions,
  hasCompleteRatingMap,
  neurodivergentContextOptions,
  normalizeRatingMap,
  strengthRatingOptions,
  strengthOptions,
  workplaceEffortRatingOptions,
  workplaceTriggerOptions,
  type CoachingPriorityRating,
  type CoachingStyleRating,
  type RatingMap,
  type StrengthRating,
  type WorkplaceEffortRating,
} from "@/lib/onboarding";
import { safeInternalPath } from "@/lib/auth-next";
import { CONNECTED_APPS, type ConnectedAppId } from "@/lib/connected-apps";

const steps = [
  "Before we begin",
  "Name",
  "Strengths",
  "Effort",
  "Coaching",
  "Context",
  "Apps",
];

function toggleValue(list: string[], value: string, max?: number) {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (max && list.length >= max) return list;
  return [...list, value];
}

function OptionButton({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-sm border px-3 py-2 text-sm transition-colors ${
        selected
          ? "border-primary bg-primary-light text-primary"
          : "border-border bg-white text-ink hover:border-primary-mid"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {label}
    </button>
  );
}

function TrustNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-sm border border-primary/15 bg-primary-light/40 p-3 text-xs leading-relaxed text-ink-mid">
      {children}
    </div>
  );
}

function RatingQuestion<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="rounded-sm border border-border bg-white p-3">
      <legend className="px-1 text-sm font-medium leading-snug text-ink">{label}</legend>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-sm border px-2 py-2 text-center text-xs leading-tight transition-colors ${
              value === option.value
                ? "border-primary bg-primary-light font-medium text-primary"
                : "border-border bg-bg text-ink-mid hover:border-primary-mid"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ratedCount<T extends string>(ratings: RatingMap<T>) {
  return Object.keys(ratings).length;
}

function ratingSummary<T extends string>(
  options: readonly string[],
  ratings: RatingMap<T>,
  highlightedValues: readonly T[],
) {
  const highlighted = options.filter((option) => highlightedValues.includes(ratings[option]));
  return highlighted.length ? highlighted.join(" · ") : "No strong preference selected";
}

export default function ProfileSetupForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeNext = safeInternalPath(searchParams.get("next"));
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [adultUsEligibilityConfirmed, setAdultUsEligibilityConfirmed] = useState(false);
  const [termsAndPrivacyConfirmed, setTermsAndPrivacyConfirmed] = useState(false);
  const [coachingDisclaimerConfirmed, setCoachingDisclaimerConfirmed] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [strengthRatings, setStrengthRatings] = useState<RatingMap<StrengthRating>>({});
  const [workplaceEffortRatings, setWorkplaceEffortRatings] = useState<RatingMap<WorkplaceEffortRating>>({});
  const [coachingPriorityRatings, setCoachingPriorityRatings] = useState<RatingMap<CoachingPriorityRating>>({});
  const [coachingStyleRatings, setCoachingStyleRatings] = useState<RatingMap<CoachingStyleRating>>({});
  const [context, setContext] = useState<string[]>([]);
  const [contextOther, setContextOther] = useState("");
  const [workApps, setWorkApps] = useState<ConnectedAppId[]>([]);

  useEffect(() => {
    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const hasConsent = hasCurrentBetaConsent(profile);
      if (profile?.first_login_complete && hasConsent) {
        router.replace(safeNext || "/dashboard");
        return;
      }

      if (hasConsent) {
        setAdultUsEligibilityConfirmed(true);
        setTermsAndPrivacyConfirmed(true);
        setCoachingDisclaimerConfirmed(true);
      }

      const fullName = profile?.full_name || user.user_metadata?.full_name || "";
      const [first = "", ...rest] = fullName.split(" ").filter(Boolean);
      setFirstName(profile?.first_name || first);
      setLastName(profile?.last_name || rest.join(" "));
      setDisplayName(profile?.display_name || profile?.first_name || first);
      setStrengthRatings(normalizeRatingMap(
        profile?.communication_strength_ratings,
        strengthOptions,
        strengthRatingOptions.map((option) => option.value),
      ));
      setWorkplaceEffortRatings(normalizeRatingMap(
        profile?.workplace_effort_ratings,
        workplaceTriggerOptions,
        workplaceEffortRatingOptions.map((option) => option.value),
      ));
      setCoachingPriorityRatings(normalizeRatingMap(
        profile?.coaching_priority_ratings,
        communicationPreferenceOptions,
        coachingPriorityRatingOptions.map((option) => option.value),
      ));
      setCoachingStyleRatings(normalizeRatingMap(
        profile?.coaching_style_ratings,
        coachingStyleDimensions.map((option) => option.id),
        coachingStyleRatingOptions.map((option) => option.value),
      ));
      setContext(profile?.neurodivergent_context || []);
      setContextOther(profile?.neurodivergent_context_other || "");
      setLoading(false);
    }

    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = useMemo(() => {
    if (step === 0) {
      return adultUsEligibilityConfirmed && termsAndPrivacyConfirmed && coachingDisclaimerConfirmed;
    }
    if (step === 1) return firstName.trim() && lastName.trim() && displayName.trim();
    if (step === 2) return hasCompleteRatingMap(strengthRatings, strengthOptions);
    if (step === 3) return hasCompleteRatingMap(workplaceEffortRatings, workplaceTriggerOptions);
    if (step === 4) {
      return hasCompleteRatingMap(coachingPriorityRatings, communicationPreferenceOptions)
        && hasCompleteRatingMap(coachingStyleRatings, coachingStyleDimensions.map((option) => option.id));
    }
    return true;
  }, [adultUsEligibilityConfirmed, coachingDisclaimerConfirmed, coachingPriorityRatings, coachingStyleRatings, displayName, firstName, lastName, step, strengthRatings, termsAndPrivacyConfirmed, workplaceEffortRatings]);

  async function completeOnboarding() {
    setSaving(true);
    setError("");
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const payload = {
      email,
      full_name: fullName,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      display_name: displayName.trim(),
      communication_strength_ratings: strengthRatings,
      workplace_effort_ratings: workplaceEffortRatings,
      coaching_priority_ratings: coachingPriorityRatings,
      coaching_style_ratings: coachingStyleRatings,
      neurodivergent_context: context,
      neurodivergent_context_other: contextOther.trim() || null,
      adult_us_eligibility_confirmed: adultUsEligibilityConfirmed,
      terms_accepted: termsAndPrivacyConfirmed,
      privacy_acknowledged: termsAndPrivacyConfirmed,
      coaching_disclaimer_acknowledged: coachingDisclaimerConfirmed,
      work_apps: workApps,
    };

    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Could not save onboarding. Please try again.");
      setSaving(false);
      return;
    }

    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        display_name: displayName.trim(),
        first_login_complete: true,
      },
    });

    if (safeNext) {
      router.push(safeNext);
      router.refresh();
      return;
    }

    router.push(workApps.length ? "/dashboard/apps" : "/dashboard");
    router.refresh();
  }

  function next() {
    if (!canContinue) return;
    if (step === steps.length - 1) completeOnboarding();
    else setStep((current) => current + 1);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wide text-primary mb-2">
            Beta access
          </p>
          <h1
            className="text-3xl text-ink mb-2"
            style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
          >
            Set up your Beckett coach
          </h1>
          <p className="text-sm text-ink-mid">
            Beckett beta is workplace-first. Your answers help your coach support Gmail,
            Slack, practice conversations, and workplace skill modules.
          </p>
        </div>

        <div
          className="mb-5 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((label, index) => (
            <div key={label} className="min-w-0">
              <div
                className={`h-1 rounded-pill mb-2 ${
                  index <= step ? "bg-primary" : "bg-border"
                }`}
              />
              <p className="truncate text-[11px] text-ink-light">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-card border border-border p-6 shadow-sm">
          {step === 0 && (
            <div>
              <h2 className="text-xl text-ink mb-2 font-serif">Before we begin</h2>
              <p className="text-sm text-ink-mid mb-5">
                Beckett&apos;s beta is currently available to adults in the United States. Please
                review and confirm each item before setting up your coach.
              </p>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-border p-4 transition-colors hover:border-primary-mid">
                  <input
                    type="checkbox"
                    checked={adultUsEligibilityConfirmed}
                    onChange={(event) => setAdultUsEligibilityConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm leading-relaxed text-ink">
                    I confirm that I am at least 18 years old and currently located in the United States.
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-border p-4 transition-colors hover:border-primary-mid">
                  <input
                    type="checkbox"
                    checked={termsAndPrivacyConfirmed}
                    onChange={(event) => setTermsAndPrivacyConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm leading-relaxed text-ink">
                    I agree to Beckett&apos;s{" "}
                    <Link href="/terms" target="_blank" className="text-primary underline underline-offset-2">
                      Terms of Use
                    </Link>{" "}
                    and acknowledge the{" "}
                    <Link href="/privacy" target="_blank" className="text-primary underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-border p-4 transition-colors hover:border-primary-mid">
                  <input
                    type="checkbox"
                    checked={coachingDisclaimerConfirmed}
                    onChange={(event) => setCoachingDisclaimerConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm leading-relaxed text-ink">
                    I understand that Beckett provides communication coaching, not medical,
                    mental-health, legal, or employment advice.
                  </span>
                </label>
              </div>
              <div className="mt-5">
                <TrustNote>
                  Beckett records when you accept these items and which policy versions you
                  reviewed. It does not ask for or store your date of birth.
                </TrustNote>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl text-ink mb-2 font-serif">What should Beckett call you?</h2>
              <p className="text-sm text-ink-mid mb-5">
                This is used inside your Beckett account and coaching prompts. It is not shown
                publicly to other users.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">First name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Last name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-ink mb-1">What do you want Beckett to call you?</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="mt-5">
                <TrustNote>
                  Your setup answers are saved to your Beckett profile so Beckett can coach you
                  more accurately. They are not shared publicly, and they are not used to train
                  public AI models. You can edit or remove them later.
                </TrustNote>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl text-ink mb-2 font-serif">What are your communication strengths?</h2>
              <p className="text-sm text-ink-mid mb-5">
                Rate each statement based on how true it usually feels. There are no right answers,
                and “Not sure yet” is always okay.
              </p>
              <div className="space-y-3">
                {strengthOptions.map((option) => (
                  <RatingQuestion
                    key={option}
                    label={option}
                    value={strengthRatings[option]}
                    options={strengthRatingOptions}
                    onChange={(value) => setStrengthRatings((current) => ({ ...current, [option]: value }))}
                  />
                ))}
              </div>
              <p className="text-xs text-ink-light mt-3" aria-live="polite">
                {ratedCount(strengthRatings)}/{strengthOptions.length} rated
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl text-ink mb-2 font-serif">What tends to make work communication harder?</h2>
              <p className="text-sm text-ink-mid mb-5">
                How much extra effort does each situation usually create for you at work?
              </p>
              <div className="space-y-3">
                {workplaceTriggerOptions.map((option) => (
                  <RatingQuestion
                    key={option}
                    label={option}
                    value={workplaceEffortRatings[option]}
                    options={workplaceEffortRatingOptions}
                    onChange={(value) => setWorkplaceEffortRatings((current) => ({ ...current, [option]: value }))}
                  />
                ))}
              </div>
              <p className="text-xs text-ink-light mt-3" aria-live="polite">
                {ratedCount(workplaceEffortRatings)}/{workplaceTriggerOptions.length} rated
              </p>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-xl text-ink mb-2 font-serif">How should Beckett coach you?</h2>
              <p className="text-sm text-ink-mid mb-5">
                Rate how useful each kind of support would be, then tell Beckett how much of each
                coaching quality you prefer.
              </p>
              <div className="mb-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-light">
                  How useful would Beckett’s help be in each area?
                </p>
                <div className="space-y-3">
                  {communicationPreferenceOptions.map((option) => (
                    <RatingQuestion
                      key={option}
                      label={option}
                      value={coachingPriorityRatings[option]}
                      options={coachingPriorityRatingOptions}
                      onChange={(value) => setCoachingPriorityRatings((current) => ({ ...current, [option]: value }))}
                    />
                  ))}
                </div>
                <p className="text-xs text-ink-light mt-3" aria-live="polite">
                  {ratedCount(coachingPriorityRatings)}/{communicationPreferenceOptions.length} priorities rated
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-light">
                  How much of each quality should Beckett use?
                </p>
                {coachingStyleDimensions.map((option) => (
                  <RatingQuestion
                    key={option.id}
                    label={option.label}
                    value={coachingStyleRatings[option.id]}
                    options={coachingStyleRatingOptions}
                    onChange={(value) => setCoachingStyleRatings((current) => ({ ...current, [option.id]: value }))}
                  />
                ))}
                <p className="text-xs text-ink-light mt-3" aria-live="polite">
                  {ratedCount(coachingStyleRatings)}/{coachingStyleDimensions.length} coaching qualities rated
                </p>
              </div>
              {hasCompleteRatingMap(coachingPriorityRatings, communicationPreferenceOptions)
                && hasCompleteRatingMap(coachingStyleRatings, coachingStyleDimensions.map((option) => option.id)) && (
                <div className="mt-5 rounded-sm border border-primary/20 bg-primary-light/40 p-4">
                  <p className="text-sm font-medium text-ink">Your coaching setup is ready</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-mid">
                    Beckett will use these ratings together, rather than forcing your preferences
                    into one coaching-style preset.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-xl text-ink mb-2 font-serif">
                Is there any neurodivergent context you want Beckett to know?
              </h2>
              <p className="text-sm text-ink-mid mb-5">
                Optional. This can include ADHD, autism, dyslexia, sensory processing differences,
                or anything else that helps Beckett coach you better. Beckett does not diagnose you.
              </p>
              <div className="mb-5">
                <TrustNote>
                  This context is saved to your Beckett profile and used only to shape your coaching.
                  It is not shown publicly, and you can skip this or edit it later.
                </TrustNote>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {neurodivergentContextOptions.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={context.includes(option)}
                    onClick={() => setContext((current) => toggleValue(current, option))}
                  />
                ))}
              </div>
              {context.includes("Something else") && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-ink mb-1">Something else</label>
                  <input value={contextOther} onChange={(e) => setContextOther(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div>
              <div className="mb-6 rounded-sm border border-primary/20 bg-primary-light/40 p-4">
                <p className="text-sm font-medium text-ink">Your coaching profile</p>
                <dl className="mt-3 space-y-3 text-xs leading-relaxed">
                  <div>
                    <dt className="font-medium text-ink">Strengths to build on</dt>
                    <dd className="text-ink-mid">{ratingSummary(strengthOptions, strengthRatings, ["often", "core_strength"])}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Situations needing extra care</dt>
                    <dd className="text-ink-mid">{ratingSummary(workplaceTriggerOptions, workplaceEffortRatings, ["moderate", "a_lot"])}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Coaching priorities</dt>
                    <dd className="text-ink-mid">{ratingSummary(communicationPreferenceOptions, coachingPriorityRatings, ["important", "top_priority"])}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Coaching qualities to emphasize</dt>
                    <dd className="text-ink-mid">{ratingSummary(
                      coachingStyleDimensions.map((option) => option.id),
                      coachingStyleRatings,
                      ["more"],
                    ).split(" · ").map((id) => coachingStyleDimensions.find((option) => option.id === id)?.label || id).join(" · ")}</dd>
                  </div>
                </dl>
              </div>
              <h2 className="text-xl text-ink mb-2 font-serif">Which apps do you use?</h2>
              <p className="text-sm text-ink-mid mb-5">
                Choose any that are part of your workday. They will appear in Your Apps, where Beckett will walk you through connecting or installing each one.
              </p>
              <div className="mb-4">
                <TrustNote>
                  Choosing an app here does not grant access. You will review and approve every connection separately from Your Apps.
                </TrustNote>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {CONNECTED_APPS.map((app) => {
                  const selected = workApps.includes(app.id);
                  return <button key={app.id} type="button" aria-pressed={selected} onClick={() => setWorkApps((current) => selected ? current.filter((id) => id !== app.id) : [...current, app.id])} className={`flex items-center gap-3 rounded-sm border p-3 text-left transition-colors ${selected ? "border-primary bg-primary-light" : "border-border bg-white hover:border-primary-mid"}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white"><Image src={app.iconSrc} alt="" width={36} height={36} className="h-9 w-9 object-contain" /></span><span><span className="block text-sm font-medium text-ink">{app.name}</span><span className="mt-0.5 block text-xs text-ink-mid">{selected ? "Added to Your Apps" : "Select app"}</span></span></button>;
                })}
              </div>
              <p className="mt-4 text-xs text-ink-light">
                Optional. You can add or remove apps later from the Apps tab.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-5" role="alert">{error}</p>}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || saving}
              className="text-sm border border-border rounded-pill px-5 py-2 text-ink disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={next}
              disabled={!canContinue || saving}
              className="bg-primary text-white text-sm rounded-pill px-6 py-2 hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : step === steps.length - 1 ? "Go to dashboard" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
