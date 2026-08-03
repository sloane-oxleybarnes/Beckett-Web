"use client";

import { useEffect, useState } from "react";

type Pattern = {
  id: string;
  summary: string;
  status: "proposed" | "remembered" | "dismissed" | "blocked";
  evidence: { matchingCheckins?: number; totalCheckins?: number; periodDays?: number; timeOfDay?: string };
};

export default function LearningCenter() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [whyOpen, setWhyOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/workday/checkins", { cache: "no-store" });
    const data = await response.json().catch(() => null) as { summaries?: Pattern[]; error?: string } | null;
    if (response.ok) setPatterns(data?.summaries || []);
    else setMessage(data?.error || "Could not load what Beckett is learning.");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function setStatus(id: string, status: Pattern["status"]) {
    const response = await fetch(`/api/workday/patterns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) return setMessage("That observation could not be updated. Please try again.");
    if (status === "dismissed" || status === "blocked") setPatterns((current) => current.filter((item) => item.id !== id));
    else setPatterns((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  async function remove(id: string) {
    const response = await fetch(`/api/workday/patterns/${id}`, { method: "DELETE" });
    if (!response.ok) return setMessage("That observation could not be deleted. Please try again.");
    setPatterns((current) => current.filter((item) => item.id !== id));
  }

  return <section id="what-beckett-is-learning" className="rounded-card border border-border bg-white p-5 sm:p-6">
    <p className="text-xs font-medium uppercase tracking-wide text-primary">Private learning</p>
    <h2 className="mt-1 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>What Beckett is learning</h2>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mid">These are optional observations based on the check-ins, schedule shape, and support feedback you chose to share. They are never diagnoses or labels, and you control what Beckett keeps.</p>
    {loading ? <p className="mt-5 text-sm text-ink-mid">Loading your private observations…</p> : patterns.length ? <div className="mt-5 space-y-3">{patterns.map((pattern) => <article key={pattern.id} className="rounded-sm border border-border bg-bg/50 p-4"><p className="text-sm leading-relaxed text-ink">{pattern.summary}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium"><button type="button" onClick={() => void setStatus(pattern.id, "remembered")} className="text-primary hover:underline">Remember this</button><button type="button" onClick={() => void setStatus(pattern.id, "proposed")} className="text-primary hover:underline">Ask me later</button><button type="button" onClick={() => void setStatus(pattern.id, "dismissed")} className="text-ink-mid hover:underline">Not relevant</button><button type="button" onClick={() => void setStatus(pattern.id, "blocked")} className="text-ink-mid hover:underline">Don’t use this</button><button type="button" onClick={() => setWhyOpen((current) => current === pattern.id ? null : pattern.id)} className="text-primary hover:underline">Why am I seeing this?</button><button type="button" onClick={() => void remove(pattern.id)} className="text-red-700 hover:underline">Delete</button></div>{whyOpen === pattern.id && <p className="mt-3 rounded-sm border border-border bg-white p-3 text-xs leading-relaxed text-ink-mid">This observation is based on {pattern.evidence.matchingCheckins || "relevant"} voluntary check-ins{pattern.evidence.totalCheckins ? ` out of ${pattern.evidence.totalCheckins}` : ""} from the last {pattern.evidence.periodDays || 14} days{pattern.evidence.timeOfDay ? `, focused on the ${pattern.evidence.timeOfDay}` : ""}. Beckett does not use email, Slack, or event content to create it.</p>}{pattern.status === "remembered" && <p className="mt-3 text-xs text-primary">Remembered as a preference. Beckett will still ask before offering support.</p>}</article>)}</div> : <p className="mt-5 rounded-sm border border-border bg-bg/50 p-4 text-sm leading-relaxed text-ink-mid">Nothing to show yet. Turn on private pattern learning in Settings if you want Beckett to create optional observations from repeated, relevant check-ins.</p>}
    {message && <p className="mt-3 text-sm text-red-700">{message}</p>}
  </section>;
}
