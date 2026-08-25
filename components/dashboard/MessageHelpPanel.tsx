"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { SafetyResponse } from "@/lib/safety-resources";
import type { MessageHelpAction } from "@/lib/message-help";

type WorkspaceAction = MessageHelpAction | "practice";
type ActionResult = { action: MessageHelpAction; response: string };

const actions: Array<{ value: WorkspaceAction; label: string; description: string }> = [
  { value: "decode", label: "Decode", description: "Understand what it says, possible tone, ambiguity, and what may be expected." },
  { value: "respond", label: "Respond", description: "Get clear reply options while keeping the final choice and send action with you." },
  { value: "rewrite", label: "Rewrite", description: "Make your own draft clearer, warmer, more direct, or more concise." },
  { value: "practice", label: "Practice", description: "Carry this context into a private role-play and receive feedback." },
];

const inputLabel: Record<WorkspaceAction, string> = {
  decode: "Message to understand",
  respond: "Message you want to respond to",
  rewrite: "Your current draft",
  next_steps: "Message or situation to consider",
  practice: "Message or situation you want to practice",
};

const actionLabels: Record<MessageHelpAction, string> = {
  decode: "Analysis",
  respond: "Reply options",
  rewrite: "Rewrite",
  next_steps: "Next steps",
};

function renderGuidanceCards(text: string) {
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } = { title: "", lines: [] };
  const pushCurrent = () => {
    if (current.lines.some((line) => line.trim())) sections.push(current);
    current = { title: "", lines: [] };
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line === "---") continue;
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    const labeledSection = line.match(/^(Direct|Warm|Balanced|Clear|Warmer|More concise)\s*:\s*(.*)$/i);
    if (heading || labeledSection) {
      pushCurrent();
      current.title = (heading?.[1] || labeledSection?.[1] || "").replace(/\*\*/g, "");
      if (labeledSection?.[2]) current.lines.push(labeledSection[2]);
      continue;
    }
    current.lines.push(line.replace(/\*\*/g, ""));
  }
  pushCurrent();
  if (!sections.length) sections.push({ title: "Beckett's guidance", lines: [text.trim()] });

  return sections.map((section, index) => (
    <article key={`${section.title}-${index}`} className="rounded-card border border-primary/20 bg-primary-light/20 p-5 sm:p-6">
      {/^(Direct|Warm|Balanced|Clear|Warmer|More concise)$/i.test(section.title)
        ? <p className="inline-flex rounded-pill border border-primary/25 bg-white px-3 py-1 text-sm font-semibold text-primary">{section.title}</p>
        : <p className="text-xs font-medium uppercase tracking-wide text-primary">{section.title || "Beckett's guidance"}</p>}
      <div className="mt-3 space-y-2">
        {section.lines.map((line, lineIndex) => {
          const bullet = line.match(/^[-•]\s+(.*)$/);
          return bullet
            ? <p key={lineIndex} className="ml-5 list-disc text-sm leading-7 text-ink-mid">• {bullet[1]}</p>
            : <p key={lineIndex} className="text-sm leading-7 text-ink-mid">{line}</p>;
        })}
      </div>
    </article>
  ));
}

export default function MessageHelpPanel() {
  const router = useRouter();
  const [selectedActions, setSelectedActions] = useState<WorkspaceAction[]>(["decode"]);
  const [text, setText] = useState("");
  const [person, setPerson] = useState("");
  const [context, setContext] = useState("");
  const [goal, setGoal] = useState("");
  const [response, setResponse] = useState<ActionResult[]>([]);
  const [submittedText, setSubmittedText] = useState("");
  const [submittedContext, setSubmittedContext] = useState("");
  const [safety, setSafety] = useState<SafetyResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [attachmentStatus, setAttachmentStatus] = useState<"idle" | "loading" | "error">("idle");
  const [attachmentError, setAttachmentError] = useState("");
  const [pendingAttachmentText, setPendingAttachmentText] = useState("");
  const [attachmentTarget, setAttachmentTarget] = useState<"message" | "context">("message");
  const [originalExpanded, setOriginalExpanded] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openAttachmentPicker(target: "message" | "context") {
    setAttachmentTarget(target);
    fileInputRef.current?.click();
  }

  function toggleAction(nextAction: WorkspaceAction) {
    setSelectedActions((current) => current.includes(nextAction)
      ? (current.length === 1 ? current : current.filter((value) => value !== nextAction))
      : [...current, nextAction]);
    setResponse([]);
    setSafety(null);
    setError("");
  }

  async function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAttachmentStatus("loading");
    setAttachmentError("");
    setPendingAttachmentText("");
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await fetch("/api/message-help/attachment", { method: "POST", body: formData });
      const data = await result.json().catch(() => null) as { extractedText?: string; error?: string } | null;
      if (!result.ok || !data?.extractedText) throw new Error(data?.error || "Beckett could not read that screenshot.");
      setPendingAttachmentText(data.extractedText);
      setAttachmentStatus("idle");
    } catch (requestError) {
      setAttachmentError(requestError instanceof Error ? requestError.message : "Beckett could not read that screenshot.");
      setAttachmentStatus("error");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || selectedActions.length === 0) return;
    setError("");
    setResponse([]);
    setSafety(null);

    const wantsPractice = selectedActions.includes("practice");
    const apiActions = selectedActions.filter((value): value is MessageHelpAction => value !== "practice");
    if (wantsPractice && apiActions.length === 0) {
      sessionStorage.setItem("beckett-practice-prefill", JSON.stringify({ person: person.trim() || "the other person", situation: text.trim().slice(0, 4000), goal: goal.trim() || "Practice a clear response that reflects what I want to communicate.", relationshipContext: context.trim().slice(0, 1000) }));
      router.push("/dashboard/practice?from=message-help");
      return;
    }

    setStatus("loading");
    try {
      const results = await Promise.all(apiActions.map(async (action) => {
        const result = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, text, person, conversationContext: context, goal }) });
        const data = await result.json().catch(() => null) as { response?: string | null; safety?: SafetyResponse | null; error?: string } | null;
        if (!result.ok || !data) throw new Error(data?.error || "Beckett could not prepare help right now.");
        if (data.safety) setSafety(data.safety);
        return data.response ? { action, response: data.response } : null;
      }));
      setResponse(results.filter((value): value is ActionResult => Boolean(value)));
      setSubmittedText(text.trim());
      setSubmittedContext(context.trim());
      setOriginalExpanded(false);
      setContextExpanded(false);
      setStatus("idle");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Beckett could not prepare help right now.");
      setStatus("error");
    }
  }

  function startOver() {
    setResponse([]);
    setSubmittedText("");
    setSubmittedContext("");
    setSafety(null);
    setOriginalExpanded(false);
    setContextExpanded(false);
  }

  async function requestFollowup(action: MessageHelpAction) {
    setStatus("loading");
    setError("");
    try {
      const result = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, text: submittedText, person, conversationContext: submittedContext, goal }) });
      const data = await result.json().catch(() => null) as { response?: string | null; safety?: SafetyResponse | null; error?: string } | null;
      if (!result.ok || !data) throw new Error(data?.error || "Beckett could not prepare help right now.");
      if (data.safety) setSafety(data.safety);
      if (data.response) setResponse((current) => [...current.filter((item) => item.action !== action), { action, response: data.response as string }]);
      setStatus("idle");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Beckett could not prepare help right now.");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <div className="mb-8"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary">Private message support</p><h1 className="text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Get help with a message</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mid">Paste a workplace message or your own draft, then choose one or more kinds of help. This works for messages from apps Beckett does not connect to yet.</p></div>

      {response.length === 0 ? <>
        <form onSubmit={submit} className="rounded-card border border-border bg-white p-5 shadow-sm sm:p-6">
          <fieldset><legend className="text-sm font-semibold text-ink">What would you like Beckett to do? <span className="font-normal text-ink-light">Choose as many as you need.</span></legend><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{actions.map((option) => <button key={option.value} type="button" onClick={() => toggleAction(option.value)} aria-pressed={selectedActions.includes(option.value)} className={`rounded-card border p-3 text-left transition-colors ${selectedActions.includes(option.value) ? "border-primary bg-primary-light/45" : "border-border bg-white hover:border-primary/50"}`}><span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">{option.label}<span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${selectedActions.includes(option.value) ? "border-primary bg-primary text-white" : "border-border text-transparent"}`}>✓</span></span><span className="mt-1 block text-xs leading-relaxed text-ink-mid">{option.description}</span></button>)}</div></fieldset>
          <label className="mt-6 block text-sm font-medium text-ink">{inputLabel[selectedActions[0]]}<span className="relative mt-2 block"><textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} rows={9} placeholder={selectedActions.includes("rewrite") ? "Paste the draft you wrote…" : "Paste the specific message you want Beckett to focus on…"} className="block w-full resize-y rounded-card border border-border px-4 py-3 pb-12 text-sm font-normal leading-relaxed outline-none focus:border-primary" /><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleAttachment} /><button type="button" onClick={() => openAttachmentPicker("message")} disabled={attachmentStatus === "loading"} aria-label="Attach a screenshot" title="Attach a screenshot" className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg text-base text-ink-mid transition-colors hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-60">{attachmentStatus === "loading" ? "…" : "📎"}</button></span></label><div className="mt-1 text-right text-xs text-ink-light">{text.length.toLocaleString()} / 5,000</div>
          {pendingAttachmentText && <div className="mt-4 rounded-card border border-primary/30 bg-primary-light/25 p-4"><p className="text-sm font-semibold text-ink">Check the text Beckett found</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">Confirm or edit the transcription before using it in your request.</p><textarea value={pendingAttachmentText} onChange={(event) => setPendingAttachmentText(event.target.value)} maxLength={5000} rows={6} className="mt-3 block w-full resize-y rounded-sm border border-border bg-white px-3 py-2 text-sm leading-relaxed text-ink" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { if (attachmentTarget === "context") setContext(pendingAttachmentText); else setText(pendingAttachmentText); setPendingAttachmentText(""); }} className="rounded-pill bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-dark">{attachmentTarget === "context" ? "Use in context" : "Use as message"}</button><button type="button" onClick={() => setPendingAttachmentText("")} className="rounded-pill border border-border bg-white px-4 py-2 text-xs font-medium text-ink-mid hover:border-primary hover:text-primary">Dismiss</button></div></div>}
          {attachmentError && <p role="alert" className="mt-3 text-xs text-red-700">{attachmentError}</p>}
          <details className="mt-5 rounded-card border border-border bg-bg/40 p-4"><summary className="cursor-pointer text-sm font-medium text-ink">Add context (optional)</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-sm border border-border bg-white p-3 sm:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-ink">Attachment</p><p className="mt-1 text-xs leading-relaxed text-ink-light">Add a screenshot if the message is not easy to copy. PNG, JPG, or WebP up to 10 MB.</p></div><button type="button" onClick={() => openAttachmentPicker("context")} disabled={attachmentStatus === "loading"} className="rounded-pill border border-border px-3 py-1.5 text-xs font-medium text-ink-mid hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-60">{attachmentStatus === "loading" ? "Reading…" : "Attach screenshot"}</button></div></div><label className="text-sm font-medium text-ink sm:col-span-2">Conversation context<textarea value={context} onChange={(event) => setContext(event.target.value)} maxLength={6000} rows={6} placeholder="Paste the surrounding conversation or thread here. Beckett will use the message above as the specific one to decode." className="mt-1 block w-full resize-y rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-medium text-ink">Who is this with?<input value={person} onChange={(event) => setPerson(event.target.value)} maxLength={120} placeholder="For example: my manager" className="mt-1 block w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal" /></label><label className="text-sm font-medium text-ink">What do you want to happen?<input value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} placeholder="The outcome you want" className="mt-1 block w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal" /></label></div></details>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<button type="submit" disabled={!text.trim() || status === "loading"} className="mt-5 rounded-pill bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">{status === "loading" ? "Beckett is working…" : "Analyze"}</button>
        </form>
      </> : <section aria-live="polite" className="space-y-5">
        <div className="rounded-card border border-border bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-primary">Your original message</p><p className={`mt-3 whitespace-pre-wrap text-sm leading-7 text-ink ${!originalExpanded && submittedText.length > 180 ? "line-clamp-2" : ""}`}>{submittedText}</p>{submittedText.length > 180 && <button type="button" onClick={() => setOriginalExpanded((current) => !current)} aria-expanded={originalExpanded} className="mt-2 text-sm font-medium text-primary hover:underline">{originalExpanded ? "Show less ↑" : "Show more ↓"}</button>}</div><button type="button" onClick={startOver} className="shrink-0 rounded-pill border border-border px-3 py-2 text-xs font-medium text-ink-mid hover:border-primary hover:text-primary">Edit request</button></div>{submittedContext && <div className="mt-5 border-t border-border pt-4"><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Conversation context</p><p className={`mt-2 whitespace-pre-wrap text-sm leading-7 text-ink-mid ${!contextExpanded && submittedContext.length > 180 ? "line-clamp-2" : ""}`}>{submittedContext}</p>{submittedContext.length > 180 && <button type="button" onClick={() => setContextExpanded((current) => !current)} aria-expanded={contextExpanded} className="mt-2 text-sm font-medium text-primary hover:underline">{contextExpanded ? "Show less ↑" : "Show more ↓"}</button>}</div>}</div>
        {response.map((item) => <div key={item.action} className="space-y-3"><p className="px-1 text-xs font-medium uppercase tracking-wide text-primary">Beckett&apos;s {actionLabels[item.action]}</p>{renderGuidanceCards(item.response)}</div>)}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void requestFollowup("respond")} disabled={status === "loading" || response.some((item) => item.action === "respond")} className="rounded-pill border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50">Draft reply options</button><button type="button" onClick={() => void requestFollowup("next_steps")} disabled={status === "loading" || response.some((item) => item.action === "next_steps")} className="rounded-pill border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50">Suggest next steps</button><button type="button" onClick={() => { toggleAction("practice"); sessionStorage.setItem("beckett-practice-prefill", JSON.stringify({ person: person.trim() || "the other person", situation: submittedText.slice(0, 4000), goal: goal.trim() || "Practice a clear response that reflects what I want to communicate.", relationshipContext: context.trim().slice(0, 1000) })); router.push("/dashboard/practice?from=message-help"); }} className="rounded-pill border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light">Practice this conversation</button><button type="button" onClick={startOver} className="rounded-pill border border-border bg-white px-4 py-2 text-sm font-medium text-ink-mid hover:border-primary hover:text-primary">Start another request</button></div>
      </section>}
      {safety && <section className="mt-6 rounded-card border border-amber-200 bg-amber-50 p-5"><h2 className="text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{safety.title}</h2><p className="mt-2 text-sm leading-relaxed text-ink-mid">{safety.message}</p><div className="mt-4 flex flex-col gap-2">{safety.resources.map((resource) => <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">{resource.label} ↗</a>)}</div></section>}
    </div>
  );
}
