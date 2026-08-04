"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AddToSlackButton from "@/components/integrations/AddToSlackButton";
import { createClient } from "@/lib/supabase";
import { hasCurrentBetaConsent } from "@/lib/beta-consent";
import {
  coachingToneOptions,
  communicationPreferenceOptions,
  neurodivergentContextOptions,
  strengthOptions,
  workplaceTriggerOptions,
  type CoachingTone,
} from "@/lib/onboarding";
import { CHROME_WEB_STORE_URL } from "@/lib/app-links";

const steps = [
  "Before we begin",
  "Name",
  "Strengths",
  "Triggers",
  "Coaching",
  "Context",
  "Work apps",
];

const chromeExtensionUrl = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL || CHROME_WEB_STORE_URL;

type WorkAppId = "gmail" | "slack" | "outlook" | "chrome" | "teams" | "zoom";

const workAppOptions: Array<{
  id: WorkAppId;
  label: string;
  description: string;
  availability: "available" | "planned";
  walkthrough: string[];
}> = [
  {
    id: "gmail",
    label: "Gmail",
    description: "Decode a specific email thread and work through a reply in your own voice.",
    availability: "available",
    walkthrough: [
      "Choose Connect Gmail to open Google consent.",
      "Review the read-only Gmail permission and approve it.",
      "Return to Beckett, then bring a specific thread to Decode when you want help.",
    ],
  },
  {
    id: "slack",
    label: "Slack",
    description: "Pause inside the conversations where work is already happening.",
    availability: "available",
    walkthrough: [
      "Choose Connect Slack to authorize Beckett for your workspace.",
      "Use /beckett in Slack to decode, rewrite, draft, prep, or practice.",
      "Beckett keeps the final send or post with you.",
    ],
  },
  {
    id: "outlook",
    label: "Outlook / Microsoft 365",
    description: "Use selected Outlook calendars and the Beckett task pane for messages and drafts.",
    availability: "available",
    walkthrough: [
      "Choose Connect Microsoft 365 and sign in with your Microsoft account.",
      "Select the calendars Beckett may use for planning and meeting preparation.",
      "Sideload the staging Outlook manifest, open Beckett from a message or draft, and choose Decode.",
    ],
  },
  {
    id: "chrome",
    label: "Chrome",
    description: "Use Beckett’s browser extension when you want support beside Gmail or Slack.",
    availability: "available",
    walkthrough: [
      "Install Beckett from the Chrome Web Store.",
      "Open the extension and choose Log in with Beckett.",
      "Invoke Beckett only when you want help with the page or conversation in front of you.",
    ],
  },
  {
    id: "teams",
    label: "Microsoft Teams",
    description: "A Teams connection is planned for a future staging milestone.",
    availability: "planned",
    walkthrough: [
      "Teams support is not available to connect in this preview yet.",
      "We will add a consent-first walkthrough when Teams messaging and meeting context are ready.",
    ],
  },
  {
    id: "zoom",
    label: "Zoom",
    description: "Zoom support is planned for future meeting preparation and live support work.",
    availability: "planned",
    walkthrough: [
      "Zoom support is not available to connect in this preview yet.",
      "Future setup will explain exactly what meeting context is shared and when.",
    ],
  },
];

function toggleValue<T extends string>(list: T[], value: T, max?: number): T[] {
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

export default function ProfileSetupForm() {
  const supabase = createClient();
  const router = useRouter();
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
  const [strengths, setStrengths] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [coachingTone, setCoachingTone] = useState<CoachingTone>("direct_kind");
  const [context, setContext] = useState<string[]>([]);
  const [contextOther, setContextOther] = useState("");
  const [workApps, setWorkApps] = useState<WorkAppId[]>([]);

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
        router.replace("/dashboard");
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
      setStrengths(profile?.strengths || []);
      setTriggers(profile?.workplace_triggers || []);
      setPreferences(profile?.communication_preferences || []);
      setCoachingTone(profile?.coaching_tone || "direct_kind");
      setContext(profile?.neurodivergent_context || []);
      setContextOther(profile?.neurodivergent_context_other || "");
      const savedWorkApps = user.user_metadata?.work_apps;
      setWorkApps(Array.isArray(savedWorkApps) ? savedWorkApps.filter((value): value is WorkAppId => workAppOptions.some((option) => option.id === value)) : []);
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
    if (step === 2) return strengths.length > 0;
    if (step === 3) return triggers.length > 0;
    if (step === 4) return preferences.length > 0 && coachingTone;
    return true;
  }, [adultUsEligibilityConfirmed, coachingDisclaimerConfirmed, coachingTone, displayName, firstName, lastName, preferences.length, step, strengths.length, termsAndPrivacyConfirmed, triggers.length]);

  async function completeOnboarding(destination: "dashboard" | "gmail" | "slack" | "microsoft" = "dashboard") {
    setSaving(true);
    setError("");
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const payload = {
      email,
      full_name: fullName,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      display_name: displayName.trim(),
      strengths,
      workplace_triggers: triggers,
      communication_preferences: preferences,
      coaching_tone: coachingTone,
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
        work_apps: workApps,
      },
    });

    if (destination === "gmail") {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/gmail.readonly",
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/dashboard/settings")}&integration=google`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      return;
    }

    if (destination === "slack") {
      window.location.href = "/api/slack/connect";
      return;
    }

    if (destination === "microsoft") {
      window.location.href = "/api/microsoft/connect";
      return;
    }

    router.push("/dashboard");
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
                Pick up to three. Beckett starts from what already works in workplace conversations.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {strengthOptions.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={strengths.includes(option)}
                    disabled={!strengths.includes(option) && strengths.length >= 3}
                    onClick={() => setStrengths((current) => toggleValue(current, option, 3))}
                  />
                ))}
              </div>
              <p className="text-xs text-ink-light mt-3">{strengths.length}/3 selected</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl text-ink mb-2 font-serif">What tends to make work communication harder?</h2>
              <p className="text-sm text-ink-mid mb-5">
                Pick anything that fits. This helps Beckett notice where messages, feedback,
                tone, or expectations may need extra care.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {workplaceTriggerOptions.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={triggers.includes(option)}
                    onClick={() => setTriggers((current) => toggleValue(current, option))}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-xl text-ink mb-2 font-serif">How should Beckett coach you?</h2>
              <p className="text-sm text-ink-mid mb-5">
                First choose what kind of help you want. Then choose the tone Beckett should use
                when giving coaching feedback.
              </p>
              <div className="mb-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-light">
                  What do you want help with?
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                {communicationPreferenceOptions.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={preferences.includes(option)}
                    onClick={() => setPreferences((current) => toggleValue(current, option))}
                  />
                ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-light">
                  How should Beckett sound as your coach?
                </p>
                {coachingToneOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCoachingTone(option.value)}
                    className={`w-full text-left rounded-sm border px-3 py-3 transition-colors ${
                      coachingTone === option.value
                        ? "border-primary bg-primary-light"
                        : "border-border hover:border-primary-mid"
                    }`}
                  >
                    <p className="text-sm font-medium text-ink">{option.label}</p>
                    <p className="text-xs text-ink-mid mt-0.5">{option.description}</p>
                  </button>
                ))}
              </div>
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
              <h2 className="text-xl text-ink mb-2 font-serif">Which apps do you use at work?</h2>
              <p className="text-sm text-ink-mid mb-5">
                Choose any tools that are part of your workday. Beckett will show a short connection
                walkthrough for each one you select, and you can connect only the tools you want.
              </p>
              <div className="mb-5">
                <TrustNote>
                  Selecting an app does not connect it. Connection happens only after you choose
                  its action and review the provider&apos;s consent screen.
                </TrustNote>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {workAppOptions.map((option) => (
                  <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors ${workApps.includes(option.id) ? "border-primary bg-primary-light/40" : "border-border bg-white hover:border-primary-mid"}`}>
                    <input
                      type="checkbox"
                      checked={workApps.includes(option.id)}
                      onChange={() => setWorkApps((current) => toggleValue(current, option.id))}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{option.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-ink-mid">{option.description}</span>
                      {option.availability === "planned" && <span className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wide text-ink-light">Planned</span>}
                    </span>
                  </label>
                ))}
              </div>

              {workApps.length > 0 && (
                <div className="mt-6 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Your connection walkthroughs</p>
                  {workAppOptions.filter((option) => workApps.includes(option.id)).map((option) => (
                    <div key={option.id} className="rounded-sm border border-border bg-bg/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-ink">{option.label}</p>
                          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-ink-mid">
                            {option.walkthrough.map((line) => <li key={line}>{line}</li>)}
                          </ol>
                        </div>
                        {option.id === "gmail" && <button type="button" onClick={() => completeOnboarding("gmail")} disabled={saving} className="shrink-0 rounded-pill border border-primary/30 px-3 py-2 text-xs font-medium text-primary hover:bg-primary-light disabled:opacity-50">Connect Gmail</button>}
                        {option.id === "slack" && <AddToSlackButton onClick={() => completeOnboarding("slack")} disabled={saving} />}
                        {option.id === "outlook" && <button type="button" onClick={() => completeOnboarding("microsoft")} disabled={saving} className="shrink-0 rounded-pill border border-primary/30 px-3 py-2 text-xs font-medium text-primary hover:bg-primary-light disabled:opacity-50">Connect Microsoft 365</button>}
                        {option.id === "chrome" && (chromeExtensionUrl ? <a href={chromeExtensionUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-pill border border-primary/30 px-3 py-2 text-xs font-medium text-primary hover:bg-primary-light">Install Chrome</a> : null)}
                        {option.availability === "planned" && <span className="shrink-0 rounded-pill border border-border px-3 py-2 text-xs text-ink-light">Coming later</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <TrustNote>
                  You can skip any connection for now. Beckett will keep your selections in your
                  account and you can change them later from Settings.
                </TrustNote>
              </div>
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
