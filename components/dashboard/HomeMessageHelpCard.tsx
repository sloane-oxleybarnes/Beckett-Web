"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const options = [
  ["decode", "Decode"],
  ["respond", "Respond"],
  ["rewrite", "Rewrite"],
  ["practice", "Practice"],
] as const;

export default function HomeMessageHelpCard() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [action, setAction] = useState<(typeof options)[number][0]>("decode");

  function openMessageHelp() {
    if (!text.trim()) return;
    sessionStorage.setItem("beckett-message-help-prefill", JSON.stringify({ text: text.trim(), action }));
    router.push("/dashboard/message-help");
  }

  return (
    <section className="rounded-card border border-primary/20 bg-primary-light/35 p-5 shadow-sm sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Message help</p>
      <h2 className="mt-2 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>What do you want help with?</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-mid">Paste a message or draft and choose the kind of support you want.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map(([value, label]) => <button key={value} type="button" onClick={() => setAction(value)} aria-pressed={action === value} className={`rounded-sm border px-3 py-2 text-left text-sm font-medium transition-colors ${action === value ? "border-primary bg-primary text-white" : "border-primary/25 bg-white text-ink hover:border-primary"}`}>{label}</button>)}
      </div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={5000} placeholder="Paste the message you want Beckett to focus on…" className="mt-4 block w-full resize-y rounded-card border border-border bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary" />
      <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={openMessageHelp} disabled={!text.trim()} className="rounded-pill bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">Open Message Help</button><span className="text-xs text-ink-light">You choose what Beckett sees.</span></div>
    </section>
  );
}
