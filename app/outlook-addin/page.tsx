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

export default function OutlookAddinPage() {
  const [item, setItem] = useState<{ subject: string; sender: string; body: string } | null>(null);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("Open a message or draft in Outlook, then choose Read selected item.");
  const [officeHost, setOfficeHost] = useState<string | null>(null);
  const [canInsert, setCanInsert] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [outlookAccessToken, setOutlookAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        setAuthState(response.ok && data.authenticated ? "signed-in" : "signed-out");
        setAuthEmail(typeof data.email === "string" ? data.email : null);
      })
      .catch(() => { if (!cancelled) setAuthState("unknown"); });
    return () => { cancelled = true; };
  }, []);

  function readCurrentItem() {
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
      setItem({ subject, sender, body: String(bodyResult.value || "").slice(0, 12_000) });
      setCanInsert(Boolean(current.body?.setSelectedDataAsync));
      setResult("");
      setStatus("");
    });
  }

  async function decode() {
    if (!item || authState !== "signed-in") return;
    setStatus("Decoding this selected item…");
    const response = await fetch("/api/microsoft/mail/decode", {
      method: "POST",
      headers: { "content-type": "application/json", ...(outlookAccessToken ? { Authorization: `Bearer ${outlookAccessToken}` } : {}) },
      body: JSON.stringify({ content: item.body, subject: item.subject, sender: item.sender }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setAuthState("signed-out");
      setStatus("Sign in to Beckett, return to Outlook, and refresh this pane.");
      return;
    }
    if (!response.ok) {
      setStatus(data.error || "Could not decode this item.");
      return;
    }
    setResult(data.result || "");
    setStatus("Decode complete. Beckett did not send or save anything.");
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
            setOutlookAccessToken(payload.accessToken); setAuthEmail(payload.email || null); setAuthState("signed-in"); setStatus("Connected to Beckett. You can decode the selected item."); dialog.close?.(); return;
          }
          setStatus(payload.error || "Sign-in did not complete. Please try again.");
        } catch { setStatus("Sign-in did not complete. Please try again."); }
      });
    });
  }

  function insertDraft() {
    const office = window.Office;
    const current = office?.context?.mailbox?.item;
    if (!office || !current?.body?.setSelectedDataAsync || !result) return;
    current.body.setSelectedDataAsync(result, { coercionType: office.CoercionType.Text }, (response) => {
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
    <button type="button" onClick={readCurrentItem} disabled={!officeHost} className="mt-4 rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50">Read this message</button>
    {item && <div className="mt-5 rounded-card border border-border bg-white p-4"><p className="text-xs uppercase tracking-wide text-ink-light">Selected item</p><h2 className="mt-1 text-base font-medium text-ink">{item.subject}</h2><p className="mt-1 text-xs text-ink-mid">{item.sender || "Unknown sender"}</p><button type="button" onClick={() => void decode()} disabled={authState !== "signed-in"} className="mt-4 rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Decode with Beckett</button></div>}
    {result && <div className="mt-5 rounded-card border border-border bg-white p-4"><p className="text-xs uppercase tracking-wide text-primary">Beckett’s read</p><div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{result}</div><button type="button" onClick={insertDraft} disabled={!canInsert} className="mt-4 rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:opacity-50">Insert into current draft</button>{!canInsert && <p className="mt-2 text-xs text-ink-light">Open a draft to insert text. Beckett will never send it.</p>}</div>}
  </main>;
}
