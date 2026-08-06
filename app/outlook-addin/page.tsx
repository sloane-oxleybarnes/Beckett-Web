"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type OfficeResult = { status?: string; value?: unknown };
type OfficeItem = {
  itemId?: string;
  subject?: string | { getAsync?: (callback: (result: OfficeResult) => void) => void };
  from?: { emailAddress?: string; displayName?: string } | { getAsync?: (callback: (result: OfficeResult) => void) => void };
  body?: {
    getAsync?: (coercion: string, callback: (result: OfficeResult) => void) => void;
    setSelectedDataAsync?: (value: string, options: { coercionType: string }, callback: (result: OfficeResult) => void) => void;
  };
};
type OfficeDialog = { addEventHandler?: (eventType: string, handler: (arg: { message?: string }) => void) => void; close?: () => void };
type OfficeApi = {
  context?: {
    mailbox?: {
      item?: OfficeItem;
      addHandlerAsync?: (eventType: string, handler: () => void) => void;
      convertToRestId?: (itemId: string, restVersion: string) => string;
    };
    ui?: {
      displayDialogAsync?: (url: string, options: { height: number; width: number; promptBeforeOpen: boolean }, callback: (result: { status?: string; value?: OfficeDialog }) => void) => void;
      openBrowserWindow?: (url: string) => void;
      messageParent?: (message: string) => void;
    };
  };
  onReady?: (callback: (info?: { host?: string }) => void) => void;
  CoercionType: { Text: string };
  AsyncResultStatus: { Succeeded: string };
  EventType?: { DialogMessageReceived?: string; ItemChanged?: string };
  MailboxEnums?: { RestVersion?: { v2_0?: string } };
};

declare global { interface Window { Office?: OfficeApi } }

type AuthState = "checking" | "signed-in" | "signed-out" | "unknown";
type SelectedItem = { subject: string; sender: string; body: string; itemId: string | null };
type Analysis = { intent?: string; tone?: string; want?: string; responses?: Array<{ label?: string; tag?: string; text?: string }> };
type PersistedSession = { accessToken: string; refreshToken: string };

const OUTLOOK_SESSION_KEY = "beckett-outlook-session";

function readPersistedSession(): PersistedSession | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(OUTLOOK_SESSION_KEY) || "null") as Partial<PersistedSession> | null;
    return parsed?.accessToken && parsed.refreshToken ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken } : null;
  } catch { return null; }
}

function persistSession(session: { access_token?: string; refresh_token?: string } | null) {
  try {
    if (session?.access_token && session.refresh_token) {
      window.localStorage.setItem(OUTLOOK_SESSION_KEY, JSON.stringify({ accessToken: session.access_token, refreshToken: session.refresh_token }));
    } else {
      window.localStorage.removeItem(OUTLOOK_SESSION_KEY);
    }
  } catch { /* Outlook storage may be unavailable in a restricted host. */ }
}

function readAsync<T>(run: (callback: (result: OfficeResult) => void) => void, office: OfficeApi) {
  return new Promise<T>((resolve, reject) => run((result) => result.status === office.AsyncResultStatus.Succeeded ? resolve(result.value as T) : reject(new Error("Outlook could not read this item."))));
}

export default function OutlookAddinPage() {
  const [item, setItem] = useState<SelectedItem | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [status, setStatus] = useState("Select a message or draft in Outlook, then choose Analyze message.");
  const [officeHost, setOfficeHost] = useState<string | null>(null);
  const [canInsert, setCanInsert] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [outlookAccessToken, setOutlookAccessToken] = useState<string | null>(null);
  const [needsMicrosoftConnection, setNeedsMicrosoftConnection] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    void (async () => {
      const saved = readPersistedSession();
      const { data, error } = saved
        ? await supabase.auth.setSession({ access_token: saved.accessToken, refresh_token: saved.refreshToken })
        : await supabase.auth.getSession();
      if (!active) return;
      persistSession(data.session);
      setOutlookAccessToken(data.session?.access_token || null);
      setAuthState(data.session ? "signed-in" : error ? "unknown" : "signed-out");
    })().catch(() => { if (active) setAuthState("unknown"); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      persistSession(session);
      setOutlookAccessToken(session?.access_token || null);
      setAuthState(session ? "signed-in" : "signed-out");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  function clearForNewItem() {
    setItem(null);
    setResult(null);
    setCanInsert(false);
    setNeedsMicrosoftConnection(false);
    setStatus("Message changed. Choose Analyze message for this item.");
  }

  function initializeOffice() {
    window.Office?.onReady?.((info) => {
      setOfficeHost(info?.host || "Outlook");
      window.Office?.context?.mailbox?.addHandlerAsync?.(window.Office.EventType?.ItemChanged || "ItemChanged", clearForNewItem);
    });
  }

  async function readCurrentItem(): Promise<SelectedItem> {
    const office = window.Office;
    const current = office?.context?.mailbox?.item;
    if (!office || !current?.body?.getAsync) throw new Error("Open this task pane from a message or draft in Outlook.");
    const body = String(await readAsync<string>((callback) => current.body?.getAsync?.(office.CoercionType.Text, callback), office) || "").slice(0, 12_000);
    if (!body.trim()) throw new Error("Beckett could not read this item. Try opening it in the reading pane.");
    const subjectField = current.subject;
    const subject = typeof subjectField === "string"
      ? subjectField
      : subjectField?.getAsync
        ? String(await readAsync<string>((callback) => subjectField.getAsync?.(callback), office) || "(no subject)")
        : "(no subject)";
    const directFrom = current.from && typeof current.from === "object" && "emailAddress" in current.from ? current.from : null;
    const from = directFrom || (current.from && typeof current.from === "object" && "getAsync" in current.from && current.from.getAsync
      ? await readAsync<{ emailAddress?: string; displayName?: string }>((callback) => current.from && "getAsync" in current.from ? current.from.getAsync?.(callback) : undefined, office)
      : null);
    const rawItemId = current.itemId || "";
    const itemId = rawItemId && office.context?.mailbox?.convertToRestId
      ? office.context.mailbox.convertToRestId(rawItemId, office.MailboxEnums?.RestVersion?.v2_0 || "v2.0")
      : rawItemId || null;
    const selected = { subject: subject || "(no subject)", sender: from?.emailAddress || from?.displayName || "", body, itemId };
    setItem(selected);
    setCanInsert(Boolean(current.body?.setSelectedDataAsync));
    return selected;
  }

  async function decodeItem(selectedItem: SelectedItem, thread?: Array<{ sender: string; subject: string; body: string; sentAt: string | null }>) {
    setStatus(thread ? `Analyzing ${thread.length}-message conversation…` : "Analyzing this message…");
    const response = await fetch("/api/microsoft/mail/decode", {
      method: "POST",
      headers: { "content-type": "application/json", ...(outlookAccessToken ? { Authorization: `Bearer ${outlookAccessToken}` } : {}) },
      body: JSON.stringify({ content: selectedItem.body, subject: selectedItem.subject, sender: selectedItem.sender, thread }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { setAuthState("signed-out"); setStatus("Sign in to Beckett to analyze this message."); return; }
    if (!response.ok) { setStatus(data.error || "Could not analyze this message."); return; }
    setResult(data.result && typeof data.result === "object" ? data.result as Analysis : null);
    setStatus("");
  }

  async function analyzeMessage() {
    try {
      setNeedsMicrosoftConnection(false);
      setResult(null);
      const selected = await readCurrentItem();
      if (authState !== "signed-in") return setStatus("Sign in to Beckett to analyze this message.");
      await decodeItem(selected);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Beckett could not read this item."); }
  }

  async function analyzeThread() {
    try {
      setNeedsMicrosoftConnection(false);
      setResult(null);
      const selected = await readCurrentItem();
      if (authState !== "signed-in") return setStatus("Sign in to Beckett to analyze this conversation.");
      if (!selected.itemId) return setStatus("Open a specific received message in this conversation first.");
      setStatus("Loading this conversation…");
      const response = await fetch("/api/microsoft/mail/thread", {
        method: "POST",
        headers: { "content-type": "application/json", ...(outlookAccessToken ? { Authorization: `Bearer ${outlookAccessToken}` } : {}) },
        body: JSON.stringify({ itemId: selected.itemId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNeedsMicrosoftConnection(Boolean(data.needsMicrosoftConnection));
        setStatus(data.error || "Beckett could not load this conversation.");
        return;
      }
      await decodeItem(selected, Array.isArray(data.thread) ? data.thread : []);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Beckett could not load this conversation."); }
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
          const payload = JSON.parse(event.message || "{}") as { type?: string; accessToken?: string; refreshToken?: string; error?: string };
          if (payload.type === "beckett-auth-success" && payload.accessToken && payload.refreshToken) {
            persistSession({ access_token: payload.accessToken, refresh_token: payload.refreshToken });
            void createClient().auth.setSession({ access_token: payload.accessToken, refresh_token: payload.refreshToken });
            setOutlookAccessToken(payload.accessToken);
            setAuthState("signed-in");
            setStatus("Connected to Beckett.");
            dialog.close?.();
            return;
          }
          setStatus(payload.error || "Sign-in did not complete. Please try again.");
        } catch { setStatus("Sign-in did not complete. Please try again."); }
      });
    });
  }

  function insertDraft(text: string) {
    const office = window.Office;
    const current = office?.context?.mailbox?.item;
    if (!office || !current?.body?.setSelectedDataAsync || !text) return setStatus("Open a reply or new draft, then use Insert into reply.");
    current.body.setSelectedDataAsync(text, { coercionType: office.CoercionType.Text }, (response) => {
      setStatus(response?.status === office.AsyncResultStatus.Succeeded ? "Inserted into the draft. Review it before sending." : "Outlook could not insert this reply. Use Copy response instead.");
    });
  }

  async function copyResponse(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Response copied. Paste it into any draft when you are ready.");
    } catch { setStatus("Copy was blocked by Outlook. Select the response text and copy it manually."); }
  }

  function openMicrosoftSettings() {
    const url = `${window.location.origin}/dashboard/settings#connected-accounts`;
    if (window.Office?.context?.ui?.openBrowserWindow) window.Office.context.ui.openBrowserWindow(url);
    else window.location.assign(url);
  }

  return <main className="min-h-screen bg-bg p-5 text-ink">
    <Script src="https://appsforoffice.microsoft.com/lib/1/hosted/Office.js" onLoad={initializeOffice} />
    <p className="text-xs font-medium uppercase tracking-wide text-primary">Beckett for Outlook</p>
    {!officeHost && <div className="mt-4 rounded-sm border border-primary/20 bg-primary-light/30 px-3 py-3 text-xs leading-relaxed text-ink-mid">Open this page from the Beckett task pane inside Outlook.</div>}
    {status && <div className="mt-4 rounded-sm border border-border bg-white px-3 py-3 text-xs leading-relaxed text-ink-mid" role="status">{status}</div>}
    {authState !== "signed-in" && <div className="mt-4 rounded-card border border-border bg-white p-4"><button type="button" onClick={beginOutlookSignIn} className="inline-flex rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Sign in to Beckett</button></div>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void analyzeMessage()} disabled={!officeHost || authState !== "signed-in"} className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">Analyze message</button><button type="button" onClick={() => void analyzeThread()} disabled={!officeHost || authState !== "signed-in"} className="rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50">Analyze full thread</button></div>
    <p className="mt-3 text-xs leading-relaxed text-ink-light">Pin Beckett in Outlook when you want it to stay open and follow the message you select.</p>
    {needsMicrosoftConnection && <div className="mt-4 rounded-card border border-primary/20 bg-primary-light/30 p-4"><p className="text-sm font-medium text-ink">Connect Microsoft 365 to analyze full threads</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">Beckett will request read-only access to the Outlook messages in the conversation you choose.</p><button type="button" onClick={openMicrosoftSettings} className="mt-3 rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-white">Open connected accounts</button></div>}
    {item && !result && <div className="mt-5 rounded-card border border-border bg-white p-4"><p className="text-xs uppercase tracking-wide text-ink-light">Selected item</p><h2 className="mt-1 text-base font-medium text-ink">{item.subject}</h2><p className="mt-1 text-xs text-ink-mid">{item.sender || "Unknown sender"}</p></div>}
    {result && <div className="mt-5 space-y-4"><section className="space-y-3 rounded-card border border-border bg-white p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Analysis</p><div><p className="text-xs uppercase tracking-wide text-ink-light">Intent</p><p className="mt-1 text-sm leading-relaxed text-ink">{result.intent}</p></div><div><p className="text-xs uppercase tracking-wide text-ink-light">Tone</p><p className="mt-1 text-sm leading-relaxed text-ink">{result.tone}</p></div><div><p className="text-xs uppercase tracking-wide text-ink-light">What they want</p><p className="mt-1 text-sm leading-relaxed text-ink">{result.want}</p></div></section><section className="space-y-3 rounded-card border border-border bg-white p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Response options</p>{result.responses?.map((response) => <div key={response.tag || response.label} className="border-t border-border pt-3"><p className="text-xs font-medium text-primary">{response.label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{response.text}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void copyResponse(response.text || "")} disabled={!response.text} className="rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:opacity-50">Copy response</button><button type="button" onClick={() => insertDraft(response.text || "")} disabled={!canInsert || !response.text} className="rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:opacity-50">Insert into reply</button></div></div>)}{!canInsert && <p className="text-xs text-ink-light">To insert a response, open a reply or new draft and run Beckett there. Copy is always available.</p>}</section></div>}
  </main>;
}
