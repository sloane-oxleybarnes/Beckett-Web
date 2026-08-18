"use client";

import Script from "next/script";
import { BrowserCacheLocation, createNestablePublicClientApplication, InteractionRequiredAuthError, type IPublicClientApplication } from "@azure/msal-browser";
import { useEffect, useRef, useState } from "react";

type OfficeResult = { status?: string; value?: unknown };
type OfficeDialog = {
  addEventHandler?: (eventType: string, handler: (event: { message?: string; error?: number }) => void) => void;
  close?: () => void;
};
type OfficeItem = {
  itemId?: string;
  subject?: string | { getAsync?: (callback: (result: OfficeResult) => void) => void };
  from?: { emailAddress?: string; displayName?: string } | { getAsync?: (callback: (result: OfficeResult) => void) => void };
  body?: {
    getAsync?: (coercion: string, callback: (result: OfficeResult) => void) => void;
    setSelectedDataAsync?: (value: string, options: { coercionType: string }, callback: (result: OfficeResult) => void) => void;
  };
  displayReplyFormAsync?: (formData: string | { htmlBody: string }, callback: (result: OfficeResult) => void) => void;
};
type OfficeApi = {
  context?: {
    mailbox?: {
      item?: OfficeItem;
      addHandlerAsync?: (eventType: string, handler: () => void) => void;
      convertToRestId?: (itemId: string, restVersion: string) => string;
    };
    ui?: {
      displayDialogAsync?: (
        url: string,
        options: { height: number; width: number; displayInIframe: boolean },
        callback: (result: OfficeResult) => void,
      ) => void;
      openBrowserWindow?: (url: string) => void;
      messageParent?: (message: string) => void;
    };
    requirements?: { isSetSupported?: (name: string, version?: string) => boolean };
  };
  onReady?: (callback: (info?: { host?: string }) => void) => void;
  CoercionType: { Text: string };
  AsyncResultStatus: { Succeeded: string };
  EventType?: { DialogEventReceived?: string; DialogMessageReceived?: string; ItemChanged?: string };
  MailboxEnums?: { RestVersion?: { v2_0?: string } };
};

declare global { interface Window { Office?: OfficeApi } }

type AuthState = "checking" | "signed-in" | "signed-out" | "unsupported" | "error";
type ConnectionAction = "link-account" | "mail-read" | null;
type SelectedItem = { subject: string; sender: string; body: string; itemId: string | null };
type Analysis = { intent?: string; tone?: string; want?: string; responses?: Array<{ label?: string; tag?: string; text?: string }> };

function readAsync<T>(run: (callback: (result: OfficeResult) => void) => void, office: OfficeApi) {
  return new Promise<T>((resolve, reject) => run((result) => result.status === office.AsyncResultStatus.Succeeded ? resolve(result.value as T) : reject(new Error("Outlook could not read this item."))));
}

export default function OutlookAddinPage() {
  const [item, setItem] = useState<SelectedItem | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [status, setStatus] = useState("Select a message or draft in Outlook, then choose Analyze message.");
  const [officeHost, setOfficeHost] = useState<string | null>(null);
  const [canInsert, setCanInsert] = useState(false);
  const [canOpenReply, setCanOpenReply] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [outlookAccessToken, setOutlookAccessToken] = useState<string | null>(null);
  const [beckettAccessToken, setBeckettAccessToken] = useState<string | null>(null);
  const [connectionAction, setConnectionAction] = useState<ConnectionAction>(null);
  const msalClient = useRef<IPublicClientApplication | null>(null);
  const outlookLinkAttempt = useRef<string | null>(null);
  const outlookLinkPoll = useRef<number | null>(null);

  useEffect(() => () => {
    if (outlookLinkPoll.current) window.clearInterval(outlookLinkPoll.current);
  }, []);

  async function getMsalClient() {
    if (msalClient.current) return msalClient.current;
    const config = await fetch("/api/outlook-addin/config", { cache: "no-store" }).then((response) => response.json() as Promise<{ clientId?: string | null }>);
    if (!config.clientId) throw new Error("Microsoft SSO has not been configured for Beckett yet.");
    const client = await createNestablePublicClientApplication({
      auth: { clientId: config.clientId, authority: "https://login.microsoftonline.com/common" },
      // Deliberately memory-only: no Microsoft or Beckett refresh token is kept in browser storage.
      cache: { cacheLocation: BrowserCacheLocation.MemoryStorage },
    });
    msalClient.current = client;
    return client;
  }

  async function authenticateWithMicrosoft(interactive: boolean) {
    const office = window.Office;
    if (!office?.context?.requirements?.isSetSupported?.("NestedAppAuth", "1.1")) {
      setAuthState("unsupported");
      setStatus("Microsoft SSO is not available for this mailbox. Sign in to Beckett in a secure Outlook dialog instead.");
      return;
    }
    try {
      const client = await getMsalClient();
      const request = { scopes: ["User.Read"] };
      let result;
      try {
        result = await client.acquireTokenSilent(request);
      } catch (error) {
        if (!interactive || !(error instanceof InteractionRequiredAuthError)) {
          setAuthState("signed-out");
          setStatus("Connect Beckett with your Microsoft work account to continue.");
          return;
        }
        result = await client.acquireTokenPopup(request);
      }
      setOutlookAccessToken(result.accessToken);
      setAuthState("signed-in");
      setStatus("Connected through Microsoft SSO.");
    } catch (error) {
      setAuthState("error");
      setStatus(error instanceof Error ? error.message : "Microsoft SSO could not start.");
    }
  }

  function apiAuthorizationHeader(): Record<string, string> {
    const token = outlookAccessToken || beckettAccessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function openOutlookDialog(url: string, onMessage: (message: Record<string, unknown>) => void) {
    const office = window.Office;
    const ui = office?.context?.ui;
    if (!office || !ui?.displayDialogAsync) {
      office?.context?.ui?.openBrowserWindow?.(url);
      setStatus("Outlook opened the secure sign-in in your browser. If this pane does not update, reopen Beckett after finishing sign-in.");
      return;
    }
    ui.displayDialogAsync(url, { height: 70, width: 45, displayInIframe: false }, (dialogResult) => {
      if (dialogResult.status !== office.AsyncResultStatus.Succeeded || !dialogResult.value) {
        setStatus("Outlook could not open the secure sign-in dialog. Try again or open Beckett in Outlook on the web.");
        return;
      }
      const dialog = dialogResult.value as OfficeDialog;
      const messageEvent = office.EventType?.DialogMessageReceived || "dialogMessageReceived";
      const errorEvent = office.EventType?.DialogEventReceived || "dialogEventReceived";
      let completed = false;
      dialog.addEventHandler?.(messageEvent, (event) => {
        try {
          const message = JSON.parse(event.message || "{}") as Record<string, unknown>;
          completed = true;
          onMessage(message);
          dialog.close?.();
        } catch {
          setStatus("Beckett could not verify the sign-in response. Close the dialog and try again.");
        }
      });
      dialog.addEventHandler?.(errorEvent, () => {
        if (!completed) setStatus("The secure sign-in dialog closed before Beckett finished connecting.");
      });
    });
  }

  function signInWithBeckett() {
    setStatus("Opening secure Beckett sign-in…");
    const next = "/outlook-addin/auth-complete?mode=beckett";
    const url = new URL("/auth/login", window.location.origin);
    url.searchParams.set("next", next);
    openOutlookDialog(url.toString(), (message) => {
      if (message.type !== "beckett-outlook-auth" || typeof message.accessToken !== "string") {
        setStatus("Beckett sign-in did not return a usable session. Try again.");
        return;
      }
      setBeckettAccessToken(message.accessToken);
      setAuthState("signed-in");
      setStatus("Signed in to Beckett.");
    });
  }

  function clearForNewItem() {
    setItem(null);
    setResult(null);
    setCanInsert(false);
    setCanOpenReply(false);
    setConnectionAction(null);
    setStatus("Message changed. Choose Analyze message for this item.");
  }

  function initializeOffice() {
    window.Office?.onReady?.((info) => {
      setOfficeHost(info?.host || "Outlook");
      window.Office?.context?.mailbox?.addHandlerAsync?.(window.Office.EventType?.ItemChanged || "ItemChanged", clearForNewItem);
      void authenticateWithMicrosoft(false);
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
    setCanOpenReply(Boolean(current.displayReplyFormAsync));
    return selected;
  }

  async function decodeItem(selectedItem: SelectedItem, thread?: Array<{ sender: string; subject: string; body: string; sentAt: string | null }>) {
    setStatus(thread ? `Analyzing ${thread.length}-message conversation…` : "Analyzing this message…");
    const response = await fetch("/api/microsoft/mail/decode", {
      method: "POST",
      headers: { "content-type": "application/json", ...apiAuthorizationHeader() },
      body: JSON.stringify({ content: selectedItem.body, subject: selectedItem.subject, sender: selectedItem.sender, thread }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { setAuthState("signed-out"); setStatus("Sign in to Beckett to analyze this message."); return; }
    if (response.status === 403 && data.needsMicrosoftConnection) {
      setConnectionAction("link-account");
      setStatus(data.error || "Link this Microsoft work account to your Beckett profile to analyze messages.");
      return;
    }
    if (!response.ok) { setStatus(data.error || "Could not analyze this message."); return; }
    setResult(data.result && typeof data.result === "object" ? data.result as Analysis : null);
    setStatus("");
  }

  async function analyzeMessage() {
    try {
      setConnectionAction(null);
      setResult(null);
      const selected = await readCurrentItem();
      if (authState !== "signed-in") return setStatus("Sign in to Beckett to analyze this message.");
      await decodeItem(selected);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Beckett could not read this item."); }
  }

  async function analyzeThread() {
    try {
      setConnectionAction(null);
      setResult(null);
      const selected = await readCurrentItem();
      if (authState !== "signed-in") return setStatus("Sign in to Beckett to analyze this conversation.");
      if (!selected.itemId) return setStatus("Open a specific received message in this conversation first.");
      setStatus("Loading this conversation…");
      const response = await fetch("/api/microsoft/mail/thread", {
        method: "POST",
        headers: { "content-type": "application/json", ...apiAuthorizationHeader() },
        body: JSON.stringify({ itemId: selected.itemId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setConnectionAction(data.needsMicrosoftConnection ? "mail-read" : null);
        setStatus(data.error || "Beckett could not load this conversation.");
        return;
      }
      await decodeItem(selected, Array.isArray(data.thread) ? data.thread : []);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Beckett could not load this conversation."); }
  }

  function escapeHtml(text: string) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function insertDraft(text: string) {
    const office = window.Office;
    const current = office?.context?.mailbox?.item;
    if (!office || !current || !text) return setStatus("Open a message or reply before adding this response.");
    if (current.body?.setSelectedDataAsync) {
      current.body.setSelectedDataAsync(text, { coercionType: office.CoercionType.Text }, (response) => {
        setStatus(response?.status === office.AsyncResultStatus.Succeeded ? "Inserted into the draft. Review it before sending." : "Outlook could not insert this reply. Use Copy response instead.");
      });
      return;
    }
    if (current.displayReplyFormAsync) {
      current.displayReplyFormAsync({ htmlBody: escapeHtml(text).replace(/\n/g, "<br>") }, (response) => {
        setStatus(response?.status === office.AsyncResultStatus.Succeeded ? "Opened a reply with Beckett’s response. Review it before sending." : "Outlook could not open a reply. Use Copy response instead.");
      });
      return;
    }
    setStatus("Outlook could not open a reply here. Use Copy response instead.");
  }

  async function copyResponse(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Response copied. Paste it into any draft when you are ready.");
    } catch { setStatus("Copy was blocked by Outlook. Select the response text and copy it manually."); }
  }

  async function startMicrosoftBrowserConnection(requestMailPermission: boolean) {
    if (!outlookAccessToken) return setStatus("Connect your Microsoft work account first.");
    // Open synchronously in the click gesture so Outlook web and desktop popup
    // blockers do not discard the window while the start request is running.
    const pendingWindow = window.open("about:blank", "_blank");
    if (pendingWindow) pendingWindow.opener = null;
    setStatus(requestMailPermission
      ? "Opening Beckett sign-in and Microsoft mail permission…"
      : "Opening Beckett sign-in to link this Outlook account…");
    const startPath = requestMailPermission ? "/api/outlook-link/start?permission=mail" : "/api/outlook-link/start";
    const response = await fetch(startPath, {
      method: "POST",
      headers: { Authorization: `Bearer ${outlookAccessToken}` },
    });
    const data = await response.json().catch(() => ({})) as { attempt?: string; url?: string; error?: string };
    if (!response.ok || !data.attempt || !data.url) {
      pendingWindow?.close();
      return setStatus(data.error || "Beckett could not start account linking.");
    }
    outlookLinkAttempt.current = data.attempt;
    const url = data.url;
    // Outlook on the web can silently ignore openBrowserWindow for an add-in
    // pane. A direct popup runs in the user's click gesture and is more
    // reliable there; if the browser blocks it, keep the path recoverable by
    // taking the pane itself through the linking flow.
    if (pendingWindow) pendingWindow.location.assign(url);
    else if (window.Office?.context?.ui?.openBrowserWindow) window.Office.context.ui.openBrowserWindow(url);
    else window.location.assign(url);
    if (outlookLinkPoll.current) window.clearInterval(outlookLinkPoll.current);
    const startedAt = Date.now();
    outlookLinkPoll.current = window.setInterval(() => {
      if (!outlookLinkAttempt.current || Date.now() - startedAt > 10 * 60 * 1000) {
        if (outlookLinkPoll.current) window.clearInterval(outlookLinkPoll.current);
        outlookLinkPoll.current = null;
        return;
      }
      void fetch(`/api/outlook-link/status?attempt=${encodeURIComponent(outlookLinkAttempt.current)}`, {
        headers: { Authorization: `Bearer ${outlookAccessToken}` },
        cache: "no-store",
      }).then((result) => result.json() as Promise<{ linked?: boolean; mailConnected?: boolean; expired?: boolean }>).then((result) => {
        if (result.linked && (!requestMailPermission || result.mailConnected)) {
          if (outlookLinkPoll.current) window.clearInterval(outlookLinkPoll.current);
          outlookLinkPoll.current = null;
          setConnectionAction(null);
          setStatus(requestMailPermission
            ? "Microsoft mail permission connected. Choose Analyze full thread again."
            : "Microsoft work account linked to Beckett. Choose Analyze message.");
        } else if (result.expired) {
          if (outlookLinkPoll.current) window.clearInterval(outlookLinkPoll.current);
          outlookLinkPoll.current = null;
          setStatus("That account-linking window expired. Choose Link account to try again.");
        }
      }).catch(() => undefined);
    }, 2000);
  }

  function linkMicrosoftAccount() {
    return startMicrosoftBrowserConnection(false);
  }

  function connectMailPermission() {
    if (outlookAccessToken) {
      void startMicrosoftBrowserConnection(true);
      return;
    }
    setStatus("Opening Microsoft mail permission…");
    const completePath = "/outlook-addin/auth-complete?mode=mail";
    const url = new URL("/api/microsoft/connect", window.location.origin);
    url.searchParams.set("kind", "mail");
    url.searchParams.set("next", completePath);
    openOutlookDialog(url.toString(), (message) => {
      if (message.type !== "beckett-outlook-mail-connected") {
        setStatus("Microsoft mail permission was not confirmed. Try again.");
        return;
      }
      if (typeof message.accessToken === "string") setBeckettAccessToken(message.accessToken);
      setConnectionAction(null);
      setAuthState("signed-in");
      setStatus("Microsoft mail permission connected. Choose Analyze full thread again.");
    });
  }

  return <main className="min-h-screen bg-bg p-5 text-ink">
    <Script src="https://appsforoffice.microsoft.com/lib/1/hosted/Office.js" onLoad={initializeOffice} />
    <p className="text-xs font-medium uppercase tracking-wide text-primary">Beckett for Outlook</p>
    {!officeHost && <div className="mt-4 rounded-sm border border-primary/20 bg-primary-light/30 px-3 py-3 text-xs leading-relaxed text-ink-mid">Open this page from the Beckett task pane inside Outlook.</div>}
    {status && <div className="mt-4 rounded-sm border border-border bg-white px-3 py-3 text-xs leading-relaxed text-ink-mid" role="status">{status}</div>}
    {(authState === "signed-out" || authState === "unsupported" || authState === "error") && <div className="mt-4 rounded-card border border-border bg-white p-4"><div className="flex flex-wrap gap-2">{authState !== "unsupported" && <button type="button" onClick={() => void authenticateWithMicrosoft(true)} className="inline-flex rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Connect Microsoft account</button>}<button type="button" onClick={signInWithBeckett} className="inline-flex rounded-pill border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light">Sign in to Beckett</button></div><p className="mt-2 text-xs leading-relaxed text-ink-light">Beckett sign-in is the fallback for Outlook.com and environments where Microsoft SSO is unavailable.</p></div>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void analyzeMessage()} disabled={!officeHost || authState !== "signed-in"} className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">Analyze message</button><button type="button" onClick={() => void analyzeThread()} disabled={!officeHost || authState !== "signed-in"} className="rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50">Analyze full thread</button></div>
    <p className="mt-3 text-xs leading-relaxed text-ink-light">Pin Beckett in Outlook when you want it to stay open and follow the message you select.</p>
    {connectionAction === "link-account" && <div className="mt-4 rounded-card border border-primary/20 bg-primary-light/30 p-4"><p className="text-sm font-medium text-ink">Link your Microsoft work account</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">Finish a one-time Beckett sign-in in the browser window that opens. This pane will recognize the link automatically—no Outlook refresh needed.</p><button type="button" onClick={() => void linkMicrosoftAccount()} className="mt-3 rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-white">Link Beckett account</button></div>}
    {connectionAction === "mail-read" && <div className="mt-4 rounded-card border border-primary/20 bg-primary-light/30 p-4"><p className="text-sm font-medium text-ink">Allow selected-thread access</p><p className="mt-1 text-xs leading-relaxed text-ink-mid">Full-thread analysis needs Microsoft’s read-only Mail.Read permission. Beckett uses it only after you select Analyze full thread.</p><button type="button" onClick={connectMailPermission} className="mt-3 rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-white">Connect full-thread permission</button></div>}
    {item && !result && <div className="mt-5 rounded-card border border-border bg-white p-4"><p className="text-xs uppercase tracking-wide text-ink-light">Selected item</p><h2 className="mt-1 text-base font-medium text-ink">{item.subject}</h2><p className="mt-1 text-xs text-ink-mid">{item.sender || "Unknown sender"}</p></div>}
    {result && <div className="mt-5 space-y-4"><section className="space-y-3 rounded-card border border-border bg-white p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Analysis</p><div><p className="text-xs uppercase tracking-wide text-ink-light">Intent</p><p className="mt-1 text-sm leading-relaxed text-ink">{result.intent}</p></div><div><p className="text-xs uppercase tracking-wide text-ink-light">Tone</p><p className="mt-1 text-sm leading-relaxed text-ink">{result.tone}</p></div><div><p className="text-xs uppercase tracking-wide text-ink-light">What they want</p><p className="mt-1 text-sm leading-relaxed text-ink">{result.want}</p></div></section><section className="space-y-3 rounded-card border border-border bg-white p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Response options</p>{result.responses?.map((response) => <div key={response.tag || response.label} className="border-t border-border pt-3"><p className="text-xs font-medium text-primary">{response.label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{response.text}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void copyResponse(response.text || "")} disabled={!response.text} className="rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:opacity-50">Copy response</button><button type="button" onClick={() => insertDraft(response.text || "")} disabled={(!canInsert && !canOpenReply) || !response.text} className="rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:opacity-50">{canInsert ? "Insert into reply" : "Open reply with response"}</button></div></div>)}{!canInsert && !canOpenReply && <p className="text-xs text-ink-light">Outlook does not support replies from this view. Copy is always available.</p>}</section></div>}
  </main>;
}
