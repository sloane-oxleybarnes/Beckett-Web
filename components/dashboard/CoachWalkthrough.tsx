"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AddToSlackButton from "@/components/integrations/AddToSlackButton";

type WalkthroughStep = {
  eyebrow: string;
  title: string;
  body: string;
  target?: string;
  targetLabel?: string;
  slackConnect?: boolean;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const walkthroughSteps: WalkthroughStep[] = [
  {
    eyebrow: "Welcome",
    title: "Hi, I am Beckett.",
    body:
      "I am your workplace communication coach. This dashboard is the home base for practice, skills, tool connections, and your coaching profile.",
  },
  {
    eyebrow: "Start here",
    title: "Use Start here when you are not sure what to do next.",
    body:
      "If you have a real conversation coming up, start with Practice. If nothing is urgent, pick a Skill and build a repeatable tool.",
    target: '[data-tour="start-practice"]',
    targetLabel: "Click Practice a conversation",
  },
  {
    eyebrow: "Practice",
    title: "Practice opens a guided setup.",
    body:
      "Beckett asks who you are talking to, how you know them, their style, and what conversation you want to practice before the roleplay starts.",
    target: '[data-tour="nav-practice"]',
    targetLabel: "Practice also lives in the sidebar",
  },
  {
    eyebrow: "Skills",
    title: "Skills are coached workshops.",
    body:
      "Skills are for common patterns, like introducing yourself to a new colleague or asking for clarity at work. You can save progress and come back later.",
    target: '[data-tour="start-skills"]',
    targetLabel: "Click Pick a skill",
  },
  {
    eyebrow: "Connections",
    title: "Connect the tools Beckett can coach in.",
    body:
      "The setup checklist shows Chrome extension, Gmail, and Slack status. Once Slack is connected, type /beckett in Slack Desktop for private rewrite, decode, draft, prep, tone, and follow-up help.",
    target: '[data-tour="beta-setup"]',
    targetLabel: "Check setup status here",
    slackConnect: true,
  },
  {
    eyebrow: "About Me",
    title: "Your coaching profile shapes the support.",
    body:
      "About Me stores strengths, triggers, communication preferences, neurodivergent context, and your communication toolkit. You can edit or delete items.",
    target: '[data-tour="nav-about-me"]',
    targetLabel: "Open About Me from the sidebar",
  },
  {
    eyebrow: "Settings",
    title: "You stay in control.",
    body:
      "Settings is where account details, connected tools, beta diagnostics, and deletion requests live. Nothing here is locked away from you.",
    target: '[data-tour="nav-settings"]',
    targetLabel: "Settings is always in the sidebar",
  },
];

type CoachWalkthroughProps = {
  shouldShow: boolean;
};

export default function CoachWalkthrough({ shouldShow }: CoachWalkthroughProps) {
  const [open, setOpen] = useState(shouldShow);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const current = walkthroughSteps[step];
  const isLast = step === walkthroughSteps.length - 1;

  const progress = useMemo(
    () => Math.round(((step + 1) / walkthroughSteps.length) * 100),
    [step]
  );

  useEffect(() => {
    if (!shouldShow) return;
    setStep(0);
    setOpen(true);
  }, [shouldShow]);

  useEffect(() => {
    if (!open || !current.target) {
      setTargetRect(null);
      return;
    }

    function updateTarget() {
      const element = document.querySelector(current.target || "");
      if (!element) {
        setTargetRect(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
        window.setTimeout(updateTarget, 260);
      }
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }

    updateTarget();
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [current.target, open]);

  const panelStyle = useMemo(() => {
    if (!targetRect || typeof window === "undefined") return undefined;

    const margin = 16;
    if (window.innerWidth < 768) {
      return {
        bottom: margin,
        left: margin,
        right: margin,
      };
    }

    const panelWidth = Math.min(420, window.innerWidth - margin * 2);
    const panelHeight = Math.min(380, window.innerHeight - margin * 2);
    let left = targetRect.left + targetRect.width + 20;

    if (left + panelWidth > window.innerWidth - margin) {
      left = targetRect.left - panelWidth - 20;
    }

    if (left < margin) {
      left = Math.min(
        Math.max(margin, targetRect.left),
        window.innerWidth - panelWidth - margin
      );
    }

    const maxTop = Math.max(margin, window.innerHeight - panelHeight - margin);
    const top = Math.min(
      Math.max(margin, targetRect.top + targetRect.height / 2 - panelHeight / 2),
      maxTop
    );

    return {
      top,
      left,
      width: panelWidth,
    };
  }, [targetRect]);

  async function finish() {
    setOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tour") === "1") {
        url.searchParams.delete("tour");
        const nextUrl = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState(null, "", nextUrl);
      }
    }
    await fetch("/api/onboarding/walkthrough", { method: "POST", keepalive: true }).catch(() => {});
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-ink/15 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-walkthrough-title"
      aria-describedby="coach-walkthrough-body"
    >
      {targetRect && (
        <>
          <div
            className="pointer-events-none fixed z-[81] rounded-card border-2 border-primary bg-primary-light/25 shadow-[0_0_0_9999px_rgba(186,117,23,0.12)] transition-all"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
          />
        </>
      )}

      <div className={targetRect ? "" : "relative z-[83] mx-auto flex h-full w-full items-center justify-center"}>
        <div
          className={`max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-primary/20 bg-white shadow-xl ${
            targetRect ? "fixed z-[83] max-w-[420px]" : "w-full max-w-[440px]"
          }`}
          style={panelStyle}
        >
          <div className="flex flex-col p-5 sm:p-6">
            <div className="mb-4 flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div
                  className="mb-4 h-1.5 overflow-hidden rounded-pill bg-bg"
                  role="progressbar"
                  aria-label="Walkthrough progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div className="h-full rounded-pill bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{current.eyebrow}</p>
              </div>
              <button
                type="button"
                onClick={finish}
                aria-label="Close dashboard tour"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-sm font-medium text-ink-mid transition-colors hover:border-primary-mid hover:text-ink"
              >
                X
              </button>
            </div>
            <h2
              id="coach-walkthrough-title"
              className="mt-2 text-2xl text-ink"
              style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
            >
              {current.title}
            </h2>
            <p id="coach-walkthrough-body" className="mt-3 text-sm leading-relaxed text-ink-mid">
              {current.body}
            </p>

            {current.targetLabel && (
              <div className="mt-5 rounded-card border border-primary/20 bg-primary-light/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Where to click</p>
                <p className="mt-1 text-sm text-ink">{current.targetLabel}</p>
              </div>
            )}

            {current.slackConnect && (
              <div className="mt-4 rounded-card border border-border bg-bg/70 p-3">
                <p className="mb-2 text-xs font-medium text-ink">Connect Slack from Beckett</p>
                <AddToSlackButton href="/api/slack/connect" onClick={() => void finish()} />
              </div>
            )}

            {isLast && (
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <Link
                  href="/dashboard/practice"
                  onClick={() => void finish()}
                  className="rounded-pill bg-primary px-4 py-2 text-center text-xs font-medium text-white hover:bg-primary-dark"
                >
                  Start practice
                </Link>
                <Link
                  href="/dashboard/skills"
                  onClick={() => void finish()}
                  className="rounded-pill border border-border bg-white px-4 py-2 text-center text-xs font-medium text-ink hover:bg-primary-light"
                >
                  Explore skills
                </Link>
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-pill border border-border bg-white px-4 py-2 text-xs font-medium text-ink hover:bg-primary-light"
                >
                  Stay here
                </button>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}
                disabled={step === 0}
                className="rounded-pill border border-border px-4 py-2 text-sm text-ink disabled:opacity-40"
              >
                Back
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  Finish
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((currentStep) => currentStep + 1)}
                  className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
