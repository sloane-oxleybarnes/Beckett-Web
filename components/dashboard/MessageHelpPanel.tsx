"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SafetyResponse } from "@/lib/safety-resources";
import type { MessageHelpAction } from "@/lib/message-help";

type WorkspaceAction = MessageHelpAction | "practice";

const actions: Array<{ value: WorkspaceAction; label: string; description: string }> = [
  { value: "decode", label: "Decode", description: "Understand what it says, possible tone, ambiguity, and what may be expected." },
  { value: "respond", label: "Respond", description: "Get clear reply options while keeping the final choice and send action with you." },
  { value: "rewrite", label: "Rewrite", description: "Make your own draft clearer, warmer, more direct, or more concise." },
  { value: "prep", label: "Prep", description: "Prepare an outcome, opening line, talking points, and possible pushback." },
  { value: "practice", label: "Practice", description: "Carry this context into a private role-play and receive feedback." },
];

const inputLabel: Record<WorkspaceAction, string> = {
  decode: "Message to understand",
  respond: "Message you want to respond to",
  rewrite: "Your current draft",
  prep: "Message or situation you want to prepare for",
  practice: "Message or situation you want to practice",
};

const submitLabel: Record<WorkspaceAction, string> = {
  decode: "Decode this message",
  respond: "Draft reply options",
  rewrite: "Rewrite my draft",
  prep: "Prepare for the conversation",
  practice: "Continue to Practice",
};

export default function MessageHelpPanel() {
  const router = useRouter();
  const [action, setAction] = useState<WorkspaceAction>("decode");
  const [text, setText] = useState("");
  const [person, setPerson] = useState("");
  const [context, setContext] = useState("");
  const [goal, setGoal] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [safety, setSafety] = useState<SafetyResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  function chooseAction(nextAction: WorkspaceAction) {
    setAction(nextAction);
    setResponse(null);
    setSafety(null);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setError("");
    setResponse(null);
    setSafety(null);

    if (action === "practice") {
      sessionStorage.setItem("beckett-practice-prefill", JSON.stringify({
        person: person.trim() || "the other person",
        situation: text.trim().slice(0, 4000),
        goal: goal.trim() || "Practice a clear response that reflects what I want to communicate.",
        relationshipContext: context.trim().slice(0, 1000),
      }));
      router.push("/dashboard/practice?from=message-help");
      return;
    }

    setStatus("loading");
    try {
      const result = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text, person, context, goal }),
      });
      const data = await result.json().catch(() => null) as { response?: string | null; safety?: SafetyResponse | null; error?: string } | null;
      if (!result.ok || !data) throw new Error(data?.error || "Beckett could not prepare help right now.");
      setResponse(data.response || null);
      setSafety(data.safety || null);
      setStatus("idle");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Beckett could not prepare help right now.");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <div className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary">Private message support</p>
        <h1 className="text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Get help with a message</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mid">Paste a workplace message or your own draft, then choose the kind of help you want. This works for messages from apps Beckett does not connect to yet.</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-primary bg-primary-light/35 p-4"><p className="text-sm font-semibold text-ink">Paste text</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">Available now for copied messages, drafts, and situations.</p></div>
        <div className="rounded-card border border-dashed border-border bg-white p-4" aria-disabled="true"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-ink">Upload a screenshot</p><span className="rounded-pill bg-bg px-2.5 py-1 text-[11px] font-medium text-ink-light">Coming during beta</span></div><p className="mt-1 text-xs leading-relaxed text-ink-mid">Beckett will extract the text and ask you to confirm it before offering help.</p></div>
      </div>

      <form onSubmit={submit} className="rounded-card border border-border bg-white p-5 shadow-sm sm:p-6">
        <fieldset><legend className="text-sm font-semibold text-ink">What would you like Beckett to do?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{actions.map((option) => <button key={option.value} type="button" onClick={() => chooseAction(option.value)} aria-pressed={action === option.value} className={`rounded-card border p-3 text-left transition-colors ${action === option.value ? "border-primary bg-primary-light/45" : "border-border bg-white hover:border-primary/50"}`}><span className="block text-sm font-semibold text-ink">{option.label}</span><span className="mt-1 block text-xs leading-relaxed text-ink-mid">{option.description}</span></button>)}</div></fieldset>

        <label className="mt-6 block text-sm font-medium text-ink">{inputLabel[action]}<textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} rows={9} placeholder={action === "rewrite" ? "Paste the draft you wrote…" : "Paste the message or describe the situation…"} className="mt-2 block w-full resize-y rounded-card border border-border px-4 py-3 text-sm font-normal leading-relaxed outline-none focus:border-primary" /></label>
        <div className="mt-1 text-right text-xs text-ink-light">{text.length.toLocaleString()} / 5,000</div>

        <details className="mt-5 rounded-card border border-border bg-bg/40 p-4"><summary className="cursor-pointer text-sm font-medium text-ink">Add context (optional)</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-ink">Who is this with?<input value={person} onChange={(event) => setPerson(event.target.value)} maxLength={120} placeholder="For example: my manager" className="mt-1 block w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-medium text-ink">What do you want to happen?<input value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} placeholder="The outcome you want" className="mt-1 block w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-medium text-ink sm:col-span-2">What else should Beckett know?<textarea value={context} onChange={(event) => setContext(event.target.value)} maxLength={1500} rows={3} placeholder="Only include context you want Beckett to use for this request." className="mt-1 block w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal" /></label></div></details>

        <p className="mt-5 rounded-sm bg-bg px-3 py-2 text-xs leading-relaxed text-ink-mid">Beckett uses what you paste for this request. It does not add the message to your contacts or saved Practice conversations, and it never sends a reply for you.</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={!text.trim() || status === "loading"} className="mt-5 rounded-pill bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">{status === "loading" ? "Beckett is working…" : submitLabel[action]}</button>
      </form>

      {safety && <section className="mt-6 rounded-card border border-amber-200 bg-amber-50 p-5"><h2 className="text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{safety.title}</h2><p className="mt-2 text-sm leading-relaxed text-ink-mid">{safety.message}</p><div className="mt-4 flex flex-col gap-2">{safety.resources.map((resource) => <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">{resource.label} ↗</a>)}</div></section>}
      {response && <section className="mt-6 rounded-card border border-primary/20 bg-primary-light/30 p-5 sm:p-6" aria-live="polite"><p className="text-xs font-medium uppercase tracking-wide text-primary">Beckett&apos;s {actions.find((option) => option.value === action)?.label}</p><div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink">{response}</div><p className="mt-5 text-xs leading-relaxed text-ink-light">Use what fits. You stay in control of what you say or send.</p><div className="mt-4 flex flex-wrap gap-3">{action !== "respond" && <button type="button" onClick={() => chooseAction("respond")} className="rounded-pill border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light">Draft a response</button>}<button type="button" onClick={() => chooseAction("practice")} className="rounded-pill border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light">Practice the conversation</button></div></section>}
    </div>
  );
}
