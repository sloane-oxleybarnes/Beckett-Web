"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

type OfficeResult = { status?: string; value?: unknown };
type OfficeItem = {
  subject?: string;
  from?: { emailAddress?: string; displayName?: string };
  body?: {
    getAsync?: (coercion: string, callback: (result: OfficeResult) => void) => void;
    setSelectedDataAsync?: (value: string, options: { coercionType: string }, callback: (result: OfficeResult) => void) => void;
  };
};
type OfficeDialog = { addEventHandler?: (eventType: string, handler: (arg: { message?: string }) => void) => void; close?: () => void };
type OfficeApi = {
  context?: { mailbox?: { item?: OfficeItem }; ui?: { displayDialogAsync?: (url: string, options: { height: number; width: number; promptBeforeOpen: boolean }, callback: (result: { status?: string; value?: OfficeDialog }) => void) => void; messageParent?: (message: string) => void } };
  onReady?: (callback: (info?: { host?: string }) => void) => void;
  CoercionType: { Text: string };
  AsyncResultStatus: { Succeeded: string };
  EventType?: { DialogMessageReceived?: string; DialogEventReceived?: string };
};

declare global {
  interface Window { Office?: OfficeApi }
}

type AuthState = "checking" | "signed-in" | "signed-out" | "unknown";
type Analysis = { intent?: string; tone?: string; want?: string; responses?: Array<{ label?: string; tag?: string; text?: string }> };

export default function OutlookAddinPage() {
  const [item, setItem] = useState<{ subject: string; sender: string; body: string } | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [status, setStatus] = useState("Open a message or draft in Outlook, then choose Read selected item.");
  const [officeHost, setOfficeHost] = useState<string | null>(null);
  const [canInsert, setCanInsert] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [outlookAccessToken, setOutlookAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        setAuthState(response.ok && data.authenticated ? "signed-in" : "signed-out");
      })
      .catch(() => { if (!cancelled) setAuthState("unknown"); });
    return () => { cancelled = true; };
  }, []);

  async function decodeItem(selectedItem: { subject: string; sender: string; body: string }) {
    setStatus("Analyzing this message…");
    const response = await fetch("/api/microsoft/mail/decode", {
      method: "POST",
      headers: { "content-type": "application/json", ...(outlookAccessToken ? { Authorization: `Bearer ${outlookAccessToken}` } : {}) },
      body: JSON.stringify({ content: selectedItem.body, subject: selectedItem.subject, sender: selectedItem.sender }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { setAuthState("signed-out"); setStatus("Sign in to Beckett to analyze this message."); return; }
    if (!response.ok) { setStatus(data.error || "Could not analyze this message."); return; }
    setResult(data.result && typeof data.result === "object" ? data.result as Analysis : null);
    setStatus("");
  }

  function readCurrentItem(analyzeAfterRead = false) {
    const office = window.Office;
    const current = office?.context?.mailbox?.item;
    if (!office || !current) {
      setStatus("Open this task pane from a message or draft in Outlook.");
      return;
    }
    const subject = current.subject || "(no subject)";
    const sender = current.from?.emailAddress || current.from?.displayName || "";
    if (!current.body?.getAsync) {
      setStatus("Beckett could not read this item. Try opening it in the reading pane.");
      return;
    }
    current.body.getAsync(office.CoercionType.Text, (bodyResult) => {
      if (bodyResult?.status !== office.AsyncResultStatus.Succeeded) {
        setStatus("Beckett could not read this item. Try opening it in the reading pane.");
        return;
      }
      const selectedItem = { subject, sender, body: String(bodyResult.value || "").slice(0, 12_000) };
      setItem(selectedItem);
      setCanInsert(Boolean(current.body?.setSelectedDataAsync));
      setResult(null);
      setStatus("");
      if (analyzeAfterRead && authState === "signed-in") void decodeItem(selectedItem);
    });
  }

  function beginOutlookSignIn() {
    const office = window.Office;
    const openDialog = office?.context?.ui?.displayDialogAsync;
    if (!openDialog) return setStatus("Open Beckett from Outlook to sign in.");
    setStatus("Opening secure sign-in…");
    openDialog(`${window.location.origin}/auth/login?next=${encodeURIComponent("/outlook-addin/auth-complete")}`, { height: 60, width: 35, promptBeforeOpen: false }, (openResult) => {
      if (openResult.status !== office.AsyncResultStatus.Succeeded || !openResult.value) return setStatus("Sign-in could not open. Please try again.");
      const dialog = openResult.value;
      dialog.addEventHandler?.(office.EventType?.DialogMessageReceived || "DialogMessageReceived", (event) => {
        try {
          const payload = JSON.parse(event.message || "{}") as { type?: string; accessToken?: string; email?: string; error?: string };
          if (payload.type === "beckett-auth-success" && payload.accessToken) {
            setOutlookAccessToken(payload.accessToken); setAuthState("signed-in"); setStatus("Connected to Beckett. You can decode the selected item."); dialog.close?.(); return;
          }
          setStatus(payload.error || "Sign-in did not complete. Please try again.");
        } catch { setStatus("Sign-in did not complete. Please try again."); }
      });
    });
  }

  function insertDraft(text: string) {
    const office = window.Office;
    const current = office?.context?.mailbox?.item;
    if (!office || !current?.body?.setSelectedDataAsync || !text) return;
    current.body.setSelectedDataAsync(text, { coercionType: office.CoercionType.Text }, (response) => {
      setStatus(response?.status === office.AsyncResultStatus.Succeeded
        ? "Inserted into the draft. Review it before sending."
        : "This Outlook item is not a writable draft.");
    });
  }

  return <main className="min-h-screen bg-bg p-5 text-ink">
    <Script src="https://appsforoffice.microsoft.com/lib/1/hosted/Office.js" onLoad={() => window.Office?.onReady?.((info) => setOfficeHost(info?.host || "Outlook"))} />
    <p className="text-xs font-medium uppercase tracking-wide text-primary">Beckett for Outlook</p>
    {!officeHost && <div className="mt-4 rounded-sm border border-primary/20 bg-primary-light/30 px-3 py-3 text-xs leading-relaxed text-ink-mid">Open this page from the Beckett task pane inside Outlook.</div>}
    {status && <div className="mt-4 rounded-sm border border-border bg-white px-3 py-3 text-xs leading-relaxed text-ink-mid" role="status">{status}</div>}
    {authState !== "signed-in" && <div className="mt-4 rounded-card border border-border bg-white p-4"><button type="button" onClick={beginOutlookSignIn} className="inline-flex rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Sign in to Beckett</button></div>}
    <button type="button" onClick={() => readCurrentItem(true)} disabled={!officeHost} className="mt-4 rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50">Analyze message</button>
    {item && !result && <div className="mt-5 rounded-card border border-border bg-white p-4"><p className="text-xs uppercase tracking-wide text-ink-light">Selected item</p><h2 className="mt-1 text-base font-medium text-ink">{item.subject}</h2><p className="mt-1 text-xs text-ink-mid">{item.sender || "Unknown sender"}</p></div>}
    {result && <div className="mt-5 space-y-4"><section className="space-y-3 rounded-card border border-border bg-white p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Analysis</p><div><p className="text-xs uppercase tracking-wide text-ink-light">Intent</p><p className="mt-1 text-sm leading-relaxed text-ink">{result.intent}</p></div><div><p className="text-xs uppercase tracking-wide text-ink-light">Tone</p><p className="mt-1 text-sm leading-relaxed text-ink">{result.tone}</p></div><div><p className="text-xs uppercase tracking-wide text-ink-light">What they want</p><p className="mt-1 text-sm leading-relaxed text-ink">{result.want}</p></div></section><section className="space-y-3 rounded-card border border-border bg-white p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Response options</p>{result.responses?.map((response) => <div key={response.tag || response.label} className="border-t border-border pt-3"><p className="text-xs font-medium text-primary">{response.label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{response.text}</p><button type="button" onClick={() => insertDraft(response.text || "")} disabled={!canInsert || !response.text} className="mt-3 rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:opacity-50">Insert into current draft</button></div>)}{!canInsert && <p className="text-xs text-ink-light">Open a draft to insert a reply. Beckett will never send it.</p>}</section></div>}
  </main>;
}
