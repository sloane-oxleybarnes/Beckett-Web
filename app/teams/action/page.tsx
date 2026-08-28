"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Script from "next/script";

declare global {
  interface Window {
    microsoftTeams?: {
      app: {
        initialize: () => Promise<unknown>;
      };
    };
  }
}

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

type RewriteResult = {
  intent: "rewrite";
  shortRead: string;
  drafts: Array<{ label: string; text: string }>;
};

type TeamsResult = DecodeResult | DraftResult | RewriteResult;

async function requestTeamsAction(token: string, intent?: "draft") {
  const response = await fetch("/api/teams/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(intent ? { token, intent } : { token }),
  });
  const payload = await response.json().catch(() => ({})) as {
    result?: TeamsResult;
    error?: string;
    message?: string;
    connectUrl?: string;
    requestId?: string;
  };
  if (!response.ok || !payload.result) {
    const error = new Error(payload.message || "Beckett could not coach this message. Please try again.") as Error & { connectUrl?: string; code?: string; requestId?: string };
    error.connectUrl = payload.connectUrl;
    error.code = payload.error;
    error.requestId = payload.requestId;
    throw error;
  }
  return payload.result;
}

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
  const [actionToken, setActionToken] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);
  const [needsMicrosoftConnection, setNeedsMicrosoftConnection] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryIntent, setRetryIntent] = useState<"decode" | "draft">("decode");
  const [supportRequestId, setSupportRequestId] = useState(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : "unavailable"));

  const supportHref = `mailto:hello@meetbeckett.co?subject=${encodeURIComponent(`Teams problem (request ID: ${supportRequestId})`)}&body=${encodeURIComponent("Please describe what happened. Do not include the selected Teams message or other message content.")}`;

  function applyRequestError(requestError: unknown, fallback: string) {
    const typedError = requestError as Error & { connectUrl?: string; code?: string; requestId?: string };
    const code = typedError.code || (typedError.message && /expired/i.test(typedError.message) ? "teams_action_expired" : "teams_action_failed");
    setConnectUrl(typedError.connectUrl || null);
    if (typedError.requestId) setSupportRequestId(typedError.requestId);
    setErrorCode(code);
    setNeedsMicrosoftConnection(code === "microsoft_account_not_connected" || Boolean(typedError.connectUrl));
    setError(requestError instanceof Error ? requestError.message : fallback);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (window.microsoftTeams?.app) await window.microsoftTeams.app.initialize();
        if (cancelled) return;
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const token = queryParams.get("token") || hashParams.get("token");
        window.history.replaceState(null, "", window.location.pathname);
        if (!token) throw new Error("This Teams action is missing or expired. Close Beckett and select the message action again.");
        setActionToken(token);
        setResult(await requestTeamsAction(token));
      } catch (requestError) {
        if (!cancelled) {
          applyRequestError(requestError, "Beckett could not coach this message.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <>
    <Script src="https://res.cdn.office.net/teams-js/2.19.0/js/MicrosoftTeams.min.js" strategy="beforeInteractive" />
    <main className="min-h-screen bg-[#fbf8f3] px-5 py-6 text-[#1a1917]">
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Image src="/brand/beckett-icon.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" priority />
        <div><p className="font-semibold">Beckett</p><p className="text-xs text-[#746d64]">Private Teams coaching</p></div>
      </div>

      <section className="mb-6 rounded-2xl border border-[#e6ddd1] bg-[#fffdf9] p-5 shadow-sm" aria-labelledby="how-beckett-works">
        <h1 id="how-beckett-works" className="text-lg font-semibold">How Beckett works</h1>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#5f5952]">
          <li>Beckett analyzes only the message you selected.</li>
          <li>It does not read surrounding messages or conversation history.</li>
          <li>It does not save the selected message.</li>
          <li>It never sends anything automatically.</li>
          <li>The selected text is processed by Beckett’s configured AI provider to generate the coaching response.</li>
        </ul>
      </section>

      {!result && !error && <section className="rounded-2xl border border-[#e6ddd1] bg-white p-6 shadow-sm" aria-live="polite">
        <div className="h-2 w-24 animate-pulse rounded-full bg-[#d58a21]/40" />
        <h1 className="mt-5 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Reading the selected message…</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#746d64]">Beckett is analyzing only the message you selected. It does not read the surrounding Teams conversation.</p>
      </section>}

      {error && <section className="rounded-2xl border border-[#e6ddd1] bg-white p-6 shadow-sm" role="alert" aria-live="assertive">
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>
          {needsMicrosoftConnection ? "Connect Microsoft 365 to continue" : errorCode === "teams_action_expired" ? "This Teams action expired" : errorCode === "credit_limit" ? "You’ve reached your coaching limit" : "Beckett couldn’t open this message"}
        </h1>
        {needsMicrosoftConnection ? <>
          <p className="mt-3 text-sm leading-relaxed text-[#5f5952]">This Teams account is not linked to Beckett yet. Connect the same Microsoft account you use in Teams, then return here and retry.</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#5f5952]">
            <li>Select <strong>Connect Microsoft 365</strong> below.</li>
            <li>Sign in with the Microsoft account you use in Teams and approve the requested access.</li>
            <li>Return to this Teams window after Beckett confirms the connection.</li>
            <li>Select <strong>I’ve connected Microsoft 365 — try again</strong>.</li>
          </ol>
        </> : <>
          <p className="mt-3 text-sm leading-relaxed text-[#5f5952]">{error}</p>
          {errorCode === "teams_action_expired" && <p className="mt-3 text-sm leading-relaxed text-[#5f5952]">Select Beckett from the Teams message again to create a fresh action. This dialog cannot renew an expired Teams request.</p>}
          {errorCode === "credit_limit" && <p className="mt-3 text-sm leading-relaxed text-[#5f5952]">Your access will be available again when your credits renew. You can check again below after your plan or credit balance changes.</p>}
          {errorCode !== "teams_action_expired" && errorCode !== "credit_limit" && <p className="mt-3 text-sm leading-relaxed text-[#5f5952]">This may be temporary. Retry the same private request below.</p>}
        </>}
        <div className="mt-5 flex flex-wrap gap-3">
          {connectUrl && <a href={connectUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[#b86f10] px-5 py-2.5 text-sm font-medium text-white">Connect Microsoft 365</a>}
          {actionToken && <button type="button" disabled={retryLoading} onClick={() => {
            setRetryLoading(true);
            setError(null);
            setConnectUrl(null);
            void requestTeamsAction(actionToken, retryIntent === "draft" ? "draft" : undefined)
              .then((nextResult) => { setNeedsMicrosoftConnection(false); setErrorCode(null); setResult(nextResult); })
              .catch((requestError) => applyRequestError(requestError, "Beckett could not coach this message. Please try again."))
              .finally(() => setRetryLoading(false));
          }} className="inline-flex rounded-full border border-[#b86f10] px-5 py-2.5 text-sm font-medium text-[#8b5510] hover:bg-[#fff7e9] disabled:cursor-wait disabled:opacity-60">{retryLoading ? "Retrying…" : needsMicrosoftConnection ? "I’ve connected Microsoft 365 — try again" : errorCode === "credit_limit" ? "Check credits and try again" : errorCode === "teams_action_expired" ? "Try this action again" : "Try again"}</button>}
        </div>
      </section>}

      {result?.intent === "decode" && <section className="space-y-4" aria-live="polite">
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>A careful read</h1>
        {[
          ["Possible read", result.possibleRead],
          ["Visible evidence", result.visibleEvidence],
          ["What remains uncertain", result.uncertainty],
          ["Next move", result.nextMove],
        ].map(([label, text]) => <div key={label} className="rounded-2xl border border-[#e6ddd1] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-[#a9650e]">{label}</p><p className="mt-2 text-sm leading-relaxed text-[#3c3935]">{text}</p></div>)}
        {actionToken && <div className="rounded-2xl border border-[#e6ddd1] bg-white p-5 shadow-sm">
          <p className="text-sm leading-relaxed text-[#5f5952]">Want help wording a response?</p>
          <button
            type="button"
            disabled={draftLoading}
            onClick={() => {
              setRetryIntent("draft");
              setDraftLoading(true);
              setError(null);
              void requestTeamsAction(actionToken, "draft")
                .then((nextResult) => { setErrorCode(null); setResult(nextResult); })
                .catch((requestError) => applyRequestError(requestError, "Beckett could not draft a reply."))
                .finally(() => setDraftLoading(false));
            }}
            className="mt-3 rounded-full bg-[#b86f10] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#9d5e0c] disabled:cursor-wait disabled:opacity-60"
          >{draftLoading ? "Drafting…" : "Draft replies"}</button>
        </div>}
      </section>}

      {(result?.intent === "draft" || result?.intent === "rewrite") && <section className="space-y-4" aria-live="polite">
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{result.intent === "rewrite" ? "Rewrite options" : "Draft options"}</h1>
        <p className="text-sm leading-relaxed text-[#5f5952]">{result.shortRead}</p>
        {result.drafts.map((draft) => <div key={draft.label} className="rounded-2xl border border-[#e6ddd1] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-[#a9650e]">{draft.label}</p><p className="my-3 whitespace-pre-wrap text-sm leading-relaxed text-[#2f2c29]">{draft.text}</p><CopyButton text={draft.text} /></div>)}
      </section>}

      <section className="mt-6 rounded-2xl border border-[#e6ddd1] bg-white p-5 shadow-sm" aria-labelledby="teams-support">
        <h2 id="teams-support" className="text-base font-semibold">Need help?</h2>
        <p className="mt-2 text-xs leading-relaxed text-[#746d64]">Share this content-free request ID with support so we can investigate without exposing your message text: <span className="font-mono text-[#5f5952]">{supportRequestId}</span></p>
        <p className="mt-2 text-xs leading-relaxed text-[#746d64]">Please do not include the selected Teams message in your report.</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium">
          <a href={supportHref} className="text-[#8b5510] hover:underline">Report a problem</a>
          <a href="/support" target="_blank" rel="noreferrer" className="text-[#8b5510] hover:underline">Contact support</a>
        </div>
      </section>
      <p className="mt-4 text-xs leading-relaxed text-[#847b72]">Beckett does not save the selected Teams message or send anything for you. Review and edit every draft before you choose to send it.</p>
    </div>
    </main>
  </>;
}
