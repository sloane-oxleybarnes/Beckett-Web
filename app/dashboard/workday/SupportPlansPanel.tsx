"use client";

import { useEffect, useState } from "react";

type Plan = { id: string; title: string; cue: string; support_action: string; active: boolean };
type Draft = Omit<Plan, "id" | "active">;

const templates: Draft[] = [
  { title: "Protect a lunch break", cue: "My day has no obvious time for lunch.", support_action: "Help me look for a 30-minute opening or a shorter reset." },
  { title: "Reset between meetings", cue: "I have meetings close together.", support_action: "Suggest a brief pause before the next meeting when there is room." },
  { title: "Reduce an overloaded moment", cue: "I feel overloaded or cannot tell what to do first.", support_action: "Help me choose one next step and make it smaller." },
  { title: "Prepare for a manager conversation", cue: "A conversation with my manager is coming up.", support_action: "Offer meeting preparation or a short practice before it." },
  { title: "Support low energy", cue: "I select low energy during my day.", support_action: "Offer a low-pressure reset that I can choose or skip." },
];

const empty: Draft = { title: "", cue: "", support_action: "" };

export default function SupportPlansPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [draft, setDraft] = useState<Draft>(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/workday/support-plans");
    const data = await response.json().catch(() => null) as { plans?: Plan[] } | null;
    if (response.ok) setPlans(data?.plans || []);
  }

  useEffect(() => { void load(); }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/workday/support-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json().catch(() => null) as { plan?: Plan; error?: string } | null;
      if (!response.ok || !data?.plan) throw new Error(data?.error || "Could not save this support preference.");
      setPlans((current) => [data.plan!, ...current]);
      setDraft(empty);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this support preference.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(plan: Plan) {
    const response = await fetch(`/api/workday/support-plans/${plan.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !plan.active }) });
    const data = await response.json().catch(() => null) as { plan?: Plan } | null;
    if (response.ok && data?.plan) setPlans((current) => current.map((item) => item.id === plan.id ? data.plan! : item));
  }

  return <section className="rounded-card border border-border bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-primary">Your preferences</p><h2 className="mt-1 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>What helps me work well</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mid">Choose the support Beckett can offer when a moment looks similar. These are preferences, not rules—Beckett will always ask before it acts.</p></div><button type="button" onClick={() => setOpen((value) => !value)} className="text-sm font-medium text-primary hover:underline">{open ? "Close" : "Add a preference"}</button></div>
    {open && <div className="mt-5 space-y-4 rounded-sm border border-border bg-bg/50 p-4"><div><p className="text-sm font-medium text-ink">Start with something familiar</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{templates.map((template) => <button key={template.title} type="button" onClick={() => setDraft(template)} className="rounded-sm border border-border bg-white p-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary-light/30"><span className="block font-medium text-ink">{template.title}</span><span className="mt-1 block text-xs leading-relaxed text-ink-mid">{template.support_action}</span></button>)}</div></div><form onSubmit={create} className="border-t border-border pt-4"><Field label="Preference name" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} placeholder="For example: Protect a noon reset" max={120} /><Field label="When this is useful" value={draft.cue} onChange={(cue) => setDraft({ ...draft, cue })} placeholder="For example: My afternoon feels packed and I am skipping lunch" max={300} /><Field label="What I want Beckett to offer" value={draft.support_action} onChange={(support_action) => setDraft({ ...draft, support_action })} placeholder="For example: Help me find a short break I can choose or skip" max={300} /><button disabled={saving || !draft.title.trim() || !draft.cue.trim() || !draft.support_action.trim()} className="mt-4 rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? "Saving…" : "Save preference"}</button>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}</form></div>}
    {plans.length ? <div className="mt-5 space-y-3">{plans.map((plan) => <article key={plan.id} className={`rounded-sm border p-4 ${plan.active ? "border-border bg-white" : "border-border bg-bg/50 opacity-70"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium text-ink">{plan.title}</h3><p className="mt-2 text-sm text-ink-mid"><b className="text-ink">When:</b> {plan.cue}</p><p className="mt-1 text-sm text-ink-mid"><b className="text-ink">Offer:</b> {plan.support_action}</p></div><button type="button" onClick={() => void toggle(plan)} className="text-xs font-medium text-primary hover:underline">{plan.active ? "Pause" : "Resume"}</button></div></article>)}</div> : <p className="mt-5 text-sm text-ink-mid">Add a preference when you know something that tends to help. Beckett will never treat it as an instruction to act without you.</p>}
  </section>;
}

function Field({ label, value, onChange, placeholder, max }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; max: number }) {
  return <label className="mt-4 block text-sm font-medium text-ink">{label}<input value={value} onChange={(event) => onChange(event.target.value)} maxLength={max} placeholder={placeholder} className="mt-1 block w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal" /></label>;
}
