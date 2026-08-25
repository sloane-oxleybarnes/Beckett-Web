"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type DecodeResult = {
  intent: "decode";
  possibleRead: string;
  visibleEvidence: string;
  uncertainty: string;
  nextMove: string;
};

type DraftResult = {
  intent: "draft";
  shortRead: string;
  drafts: Array<{ label: string; text: string }>;
};

type TeamsResult = DecodeResult | DraftResult;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <button type="button" onClick={() => void copy()} className="rounded-full border border-[#c47b15]/40 px-4 py-2 text-sm font-medium text-[#8b5510] hover:bg-[#fff7e9]">{copied ? "Copied" : "Copy"}</button>;
}

export default function TeamsActionPage() {
  const [result, setResult] = useState<TeamsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = queryParams.get("token") || hashParams.get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setError("This Teams action is missing or expired. Close Beckett and select the message action again.");
      return;
    }
    void fetch("/api/teams/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({})) as {
        result?: TeamsResult;
        message?: string;
        connectUrl?: string;
      };
      if (!response.ok || !payload.result) {
        setConnectUrl(payload.connectUrl || null);
        throw new Error(payload.message || "Beckett could not coach this message. Please try again.");
      }
      setResult(payload.result);
    }).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : "Beckett could not coach this message.");
    });
  }, []);

  return <main className="min-h-screen bg-[#fbf8f3] px-5 py-6 text-[#1a1917]">
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Image src="/brand/beckett-icon.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" priority />
        <div><p className="font-semibold">Beckett</p><p className="text-xs text-[#746d64]">Private Teams coaching</p></div>
      </div>

      {!result && !error && <section className="rounded-2xl border border-[#e6ddd1] bg-white p-6 shadow-sm" aria-live="polite">
        <div className="h-2 w-24 animate-pulse rounded-full bg-[#d58a21]/40" />
        <h1 className="mt-5 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Reading the selected message…</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#746d64]">Beckett is analyzing only the message you selected. It does not read the surrounding Teams conversation.</p>
      </section>}

      {error && <section className="rounded-2xl border border-[#e6ddd1] bg-white p-6 shadow-sm" role="alert">
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Beckett couldn’t open this message</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5f5952]">{error}</p>
        {connectUrl && <a href={connectUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-full bg-[#b86f10] px-5 py-2.5 text-sm font-medium text-white">Connect Microsoft 365</a>}
      </section>}

      {result?.intent === "decode" && <section className="space-y-4" aria-live="polite">
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>A careful read</h1>
        {[
          ["Possible read", result.possibleRead],
          ["Visible evidence", result.visibleEvidence],
          ["What remains uncertain", result.uncertainty],
          ["Next move", result.nextMove],
        ].map(([label, text]) => <div key={label} className="rounded-2xl border border-[#e6ddd1] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-[#a9650e]">{label}</p><p className="mt-2 text-sm leading-relaxed text-[#3c3935]">{text}</p></div>)}
      </section>}

      {result?.intent === "draft" && <section className="space-y-4" aria-live="polite">
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Draft options</h1>
        <p className="text-sm leading-relaxed text-[#5f5952]">{result.shortRead}</p>
        {result.drafts.map((draft) => <div key={draft.label} className="rounded-2xl border border-[#e6ddd1] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-[#a9650e]">{draft.label}</p><p className="my-3 whitespace-pre-wrap text-sm leading-relaxed text-[#2f2c29]">{draft.text}</p><CopyButton text={draft.text} /></div>)}
      </section>}

      <p className="mt-6 text-xs leading-relaxed text-[#847b72]">Beckett does not save the selected Teams message or send anything for you. Review and edit every draft before you choose to send it.</p>
    </div>
  </main>;
}
