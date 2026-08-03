"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SharedWebContext } from "@/lib/shared-web-context";

type VisibleContext = Omit<SharedWebContext, "promptContext">;

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-bg/45 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-light">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-mid">{value}</p>
    </div>
  );
}

export default function SharedContextCard() {
  const [context, setContext] = useState<VisibleContext | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/shared-context", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { context?: VisibleContext } | null) => setContext(data?.context || null))
      .catch(() => setError(true));
  }, []);

  return (
    <section className="mb-5 rounded-card border border-border bg-white p-6" aria-labelledby="shared-context-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">One Beckett account</p>
          <h2 id="shared-context-title" className="mt-1 text-lg text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>
            What Beckett carries across the web app
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-mid">
            Home, Practice, Skills, Calendar &amp; Meetings, and About Me use the same choices. Beckett does not copy raw Gmail messages or calendar events into this shared profile.
          </p>
        </div>
        <Link href="/privacy" className="shrink-0 text-xs font-medium text-primary hover:underline">Privacy details →</Link>
      </div>

      {!context && !error && <p className="mt-4 text-sm text-ink-light">Loading your shared settings…</p>}
      {error && <p className="mt-4 text-sm text-ink-light">Your shared settings are still available; this summary could not load right now.</p>}
      {context && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Detail
            label="Coaching profile"
            value={context.profile.hasCoachingPreferences || context.profile.hasStrengths || context.profile.hasSupportConsiderations ? "Used to tailor requested coaching, not to label or diagnose you." : "Add preferences in About Me when you want more tailored support."}
          />
          <Detail
            label="Learning & patterns"
            value={context.choices.privatePatternLearning ? "Private pattern learning is on. You control recommendations and can clear this history." : "Private pattern learning is off. Beckett will not build pattern summaries from check-ins."}
          />
          <Detail
            label="Saved context"
            value={`${context.savedContext.toolkitItems} saved phrase${context.savedContext.toolkitItems === 1 ? "" : "s"}, ${context.savedContext.contacts} contact${context.savedContext.contacts === 1 ? "" : "s"}, and ${context.savedContext.activeSupportPlans} active support plan${context.savedContext.activeSupportPlans === 1 ? "" : "s"}.`}
          />
          <Detail
            label="Connected tools"
            value={`${context.connectedTools.gmail ? "Gmail connected" : "Gmail not connected"} · ${context.connectedTools.calendar ? "Calendar connected" : "Calendar not connected"}. Connections can be changed below.`}
          />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-light">
        <Link href="/dashboard/about" className="hover:text-primary hover:underline">Edit About Me</Link>
        <Link href="/dashboard/contacts" className="hover:text-primary hover:underline">Manage contacts</Link>
        <Link href="/dashboard/workday" className="hover:text-primary hover:underline">Review support plans</Link>
      </div>
    </section>
  );
}
