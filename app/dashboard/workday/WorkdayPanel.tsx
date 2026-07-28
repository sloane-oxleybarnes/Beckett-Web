"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type PatternSummary, type WorkdayCheckin } from "@/lib/workday-patterns";

type Response = { checkins: Array<WorkdayCheckin & { id: string; checked_in_at: string }>; summaries: PatternSummary[]; error?: string };

export default function WorkdayPanel() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/workday/checkins", { cache: "no-store" });
      const payload = await response.json() as Response;
      if (!response.ok) throw new Error(payload.error || "Could not load workday coaching.");
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load workday coaching.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <div className="max-w-3xl">
    <h1 className="mb-2 text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>What Beckett is learning</h1>
    <p className="mb-8 text-sm text-ink-mid">Private observations based only on the check-ins and feedback you choose to share.</p>
    <div className="mb-5 rounded-sm border border-primary/15 bg-primary-light/40 p-4 text-sm leading-relaxed text-ink-mid">Your daily check-in now lives on Home. Beckett does not monitor your activity, and it will only use patterns when you enabled them in Settings.</div>
    {error && <div className="mb-5 rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <section className="rounded-card border border-border bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Patterns you asked Beckett to summarize</h2><p className="mt-1 text-xs text-ink-mid">Each statement is based only on your voluntary check-ins from the last 14 days.</p></div><Link href="/dashboard/settings" className="text-xs font-medium text-primary hover:underline">Pattern settings</Link></div>{loading ? <p className="mt-5 text-sm text-ink-mid">Loading your check-ins…</p> : data?.summaries.length ? <div className="mt-5 space-y-3">{data.summaries.map((summary, index) => <article key={`${summary.category}-${index}`} className="rounded-sm border border-border bg-bg/50 p-4"><p className="text-sm text-ink">{summary.summary}</p><p className="mt-2 text-xs text-ink-light">Based on {summary.evidence.matchingCheckins} of {summary.evidence.totalCheckins} check-ins in the last {summary.evidence.periodDays} days.</p></article>)}</div> : <p className="mt-5 text-sm leading-relaxed text-ink-mid">No pattern summaries yet. Save at least three check-ins and turn on “Allow future pattern summaries” in Settings if you want Beckett to create them.</p>}</section>
    <section className="mt-6 rounded-card border border-border bg-white p-6"><h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Workplace supports</h2><p className="mt-1 text-sm leading-relaxed text-ink-mid">Prepare a clear, user-controlled request for a workplace support or accommodation. Beckett does not provide legal advice.</p><Link href="/dashboard/accommodations" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Open the request builder →</Link></section>
  </div>;
}
