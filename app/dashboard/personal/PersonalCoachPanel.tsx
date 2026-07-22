"use client";

import Link from "next/link";
import { useState } from "react";

const pillars = [
  { value: "boundaries", label: "Boundaries & conflict", description: "Say no, ask for a change, or repair a misunderstanding." },
  { value: "friendship", label: "Friendship & connection", description: "Make plans, reconnect, or navigate uncertainty." },
  { value: "family_roommates", label: "Family & roommates", description: "Clarify expectations and address recurring friction." },
  { value: "dating", label: "Dating & early relationships", description: "Handle interest, pacing, ambiguity, or a respectful no." },
] as const;

type Safety = { title: string; message: string; resources: Array<{ label: string; href: string }> };

export default function PersonalCoachPanel() {
  const [pillar, setPillar] = useState<(typeof pillars)[number]["value"]>("boundaries");
  const [intent, setIntent] = useState<"decode" | "draft">("decode");
  const [tone, setTone] = useState("warm and direct");
  const [text, setText] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [safety, setSafety] = useState<Safety | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(null); setResponse(null); setSafety(null);
    try {
      const res = await fetch("/api/personal-coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pillar, intent, tone, text }) });
      const data = await res.json() as { response?: string; safety?: Safety; error?: string };
      if (!res.ok) throw new Error(data.error || "Beckett could not prepare coaching.");
      if (data.safety) setSafety(data.safety); else setResponse(data.response || "");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Beckett could not prepare coaching."); }
    finally { setLoading(false); }
  }

  return <div className="max-w-3xl"><h1 className="mb-2 text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Personal communication</h1><p className="mb-7 text-sm text-ink-mid">Get clear, practical support for the conversations that happen outside work.</p><div className="mb-5 rounded-sm border border-primary/15 bg-primary-light/40 p-4 text-sm leading-relaxed text-ink-mid">Beckett uses only what you choose to share here. It does not save this context as conversation history. For support involving immediate safety, health, legal disputes, or crisis, Beckett will direct you to appropriate resources.</div><form onSubmit={submit} className="rounded-card border border-border bg-white p-6"><h2 className="mb-4 text-lg text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>What do you want help with?</h2><div className="grid gap-3 sm:grid-cols-2">{pillars.map((option) => <button key={option.value} type="button" onClick={() => setPillar(option.value)} className={`rounded-sm border p-3 text-left ${pillar === option.value ? "border-primary bg-primary-light" : "border-border hover:border-primary-mid"}`}><p className="text-sm font-medium text-ink">{option.label}</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">{option.description}</p></button>)}</div><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setIntent("decode")} className={`rounded-pill border px-4 py-2 text-sm ${intent === "decode" ? "border-primary bg-primary text-white" : "border-border text-ink-mid"}`}>Help me understand it</button><button type="button" onClick={() => setIntent("draft")} className={`rounded-pill border px-4 py-2 text-sm ${intent === "draft" ? "border-primary bg-primary text-white" : "border-border text-ink-mid"}`}>Help me draft a response</button></div><label className="mt-5 block text-sm font-medium text-ink">Preferred tone <input value={tone} onChange={(e) => setTone(e.target.value)} maxLength={80} className="mt-1 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" /></label><label className="mt-4 block text-sm font-medium text-ink">Message or situation <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={8} placeholder="Paste the message, or describe what happened and what you want to communicate." className="mt-1 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal leading-relaxed" /></label><button disabled={loading || !text.trim()} type="submit" className="mt-5 rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Thinking…" : intent === "decode" ? "Help me understand" : "Draft responses"}</button></form>{error && <div className="mt-5 rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}{safety && <section className="mt-5 rounded-card border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{safety.title}</h2><p className="mt-2 text-sm leading-relaxed text-ink-mid">{safety.message}</p><div className="mt-4 flex flex-col gap-2">{safety.resources.map((resource) => <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">{resource.label} ↗</a>)}</div></section>}{response && <section className="mt-5 rounded-card border border-border bg-white p-6"><h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Beckett&apos;s coaching</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{response}</p><p className="mt-4 text-xs leading-relaxed text-ink-light">Use what fits; you are always in control of what you say or send.</p></section>}<p className="mt-6 text-sm text-ink-mid">Want to practice before you send? <Link href="/dashboard/practice" className="font-medium text-primary hover:underline">Open Practice</Link>.</p></div>;
}
