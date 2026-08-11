"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type OfficeResult = { status?: string; value?: unknown };
type OfficeAddress = { emailAddress?: string; displayName?: string };
type OfficeAsyncProperty = {
  getAsync?: (callback: (result: OfficeResult) => void) => void;
};
type OfficeItem = {
  subject?: string | OfficeAsyncProperty;
  from?: OfficeAddress | OfficeAsyncProperty;
  body?: {
    getAsync?: (coercion: string, callback: (result: OfficeResult) => void) => void;
  };
};
type OfficeApi = {
  context?: {
    mailbox?: { item?: OfficeItem };
    ui?: {
      displayDialogAsync?: (
        url: string,
        options: { height: number; width: number; promptBeforeOpen: boolean },
        callback: (result: { status?: string; value?: OfficeDialog }) => void,
      ) => void;
      messageParent?: (message: string) => void;
    };
  };
  onReady?: (callback: (info?: { host?: string }) => void) => void;
  CoercionType: { Text: string };
  AsyncResultStatus: { Succeeded: string };
  EventType?: { DialogMessageReceived?: string; DialogEventReceived?: string };
};
type OfficeDialog = {
  addEventHandler?: (eventType: string, handler: (arg: { message?: string; error?: number }) => void) => void;
  close?: () => void;
};

declare global {
  interface Window {
    Office?: OfficeApi;
  }
}

type AuthState = "checking" | "signed-in" | "signed-out" | "unknown";

function getAsyncProperty(value: OfficeAsyncProperty, succeededStatus: string) {
  return new Promise<unknown>((resolve, reject) => {
    if (!value.getAsync) {
      resolve(undefined);
      return;
    }
    value.getAsync((result) => {
      if (result.status !== succeededStatus) {
        reject(new Error("Outlook could not read this item property."));
        return;
      }
      resolve(result.value);
    });
  });
}

async function getSubject(current: OfficeItem, succeededStatus: string) {
  if (typeof current.subject === "string") return current.subject || "(no subject)";
  if (!current.subject) return "(no subject)";
  const value = await getAsyncProperty(current.subject, succeededStatus);
  return typeof value === "string" && value ? value : "(no subject)";
}

async function getSender(current: OfficeItem, succeededStatus: string) {
  if (!current.from) return "";
  const value = "getAsync" in current.from
    ? await getAsyncProperty(current.from, succeededStatus)
    : current.from;
  if (!value || typeof value !== "object") return "";
  const address = value as OfficeAddress;
  return address.emailAddress || address.displayName || "";
}

function getBody(current: OfficeItem, office: OfficeApi) {
  return new Promise<string>((resolve, reject) => {
    if (!current.body?.getAsync) {
      reject(new Error("This Outlook item does not expose a readable body."));
      return;
    }
    current.body.getAsync(office.CoercionType.Text, (result) => {
      if (result.status !== office.AsyncResultStatus.Succeeded) {
        reject(new Error("Outlook could not read this item body."));
        return;
      }
      resolve(String(result.value || "").slice(0, 18_000));
    });
  });
}

export default function OutlookAddinPage() {
  const [item, setItem] = useState<{ subject: string; sender: string; body: string } | null>(null);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("Open a message in Microsoft Outlook to begin.");
  const [ready, setReady] = useState(false);
  const [officeHost, setOfficeHost] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [outlookAccessToken, setOutlookAccessToken] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        setAuthState(response.ok && data.authenticated ? "signed-in" : "signed-out");
        setAuthEmail(typeof data.email === "string" ? data.email : null);
      })
      .catch(() => {
        if (!cancelled) setAuthState("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function readCurrentItem() {
    const office = window.Office;
    const current = office?.context?.mailbox?.item;
    if (!office || !current) {
      setStatus("Open a message in Outlook to begin.");
      return;
    }

    setReady(false);
    setStatus("Reading the selected Outlook item…");
    try {
      const [subject, sender, body] = await Promise.all([
        getSubject(current, office.AsyncResultStatus.Succeeded),
        getSender(current, office.AsyncResultStatus.Succeeded),
        getBody(current, office),
      ]);
      setItem({ subject, sender, body });
      setReady(true);
      setStatus("Ready. Beckett will only use this selected item for the next action.");
    } catch {
      setItem(null);
      setStatus("Beckett could not read this item. Try opening it in the reading pane.");
    }
  }

  async function decode() {
    if (!item || decoding) return;
    setDecoding(true);
    setResult("");
    setStatus("Reading this message privately…");
    try {
      const response = await fetch("/api/microsoft/mail/decode", {
        method: "POST",
        headers: { "content-type": "application/json", ...(outlookAccessToken ? { Authorization: `Bearer ${outlookAccessToken}` } : {}) },
        body: JSON.stringify({ content: item.body, subject: item.subject, sender: item.sender }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setAuthState("signed-out");
        setStatus("Your Beckett session expired. Sign in again, then retry Decode.");
        return;
      }
      if (!response.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Could not decode this item.");
        return;
      }
      setResult(typeof data.result === "string" ? data.result : "");
      setStatus("Decode complete. Nothing was sent or saved.");
    } catch {
      setStatus("Beckett could not reach the coaching service. Check your connection and try again.");
    } finally {
      setDecoding(false);
    }
  }

  function beginAccountFlow(path: "/auth/login" | "/auth/signup", openingMessage: string) {
    const office = window.Office;
    const openDialog = office?.context?.ui?.displayDialogAsync;
    if (!openDialog) {
      setStatus("Open Beckett from Outlook to manage your account.");
      return;
    }
    setStatus(openingMessage);
    const authUrl = `${window.location.origin}${path}?next=${encodeURIComponent("/outlook-addin/auth-complete")}`;
    openDialog(authUrl, { height: 60, width: 35, promptBeforeOpen: false }, (openResult) => {
      if (openResult.status !== office.AsyncResultStatus.Succeeded || !openResult.value) {
        setStatus("Sign-in could not open. Please try again.");
        return;
      }
      const dialog = openResult.value;
      let completed = false;
      dialog.addEventHandler?.(office.EventType?.DialogMessageReceived || "DialogMessageReceived", (event) => {
        try {
          const payload = JSON.parse(event.message || "{}") as { type?: string; accessToken?: string; email?: string; error?: string };
          if (payload.type === "beckett-auth-success" && payload.accessToken) {
            completed = true;
            setOutlookAccessToken(payload.accessToken);
            setAuthEmail(payload.email || null);
            setAuthState("signed-in");
            setStatus("Connected to Beckett. You can decode the selected item.");
            dialog.close?.();
            return;
          }
          setStatus(payload.error || "Sign-in did not complete. Please try again.");
        } catch {
          setStatus("Sign-in did not complete. Please try again.");
        }
      });
      dialog.addEventHandler?.(office.EventType?.DialogEventReceived || "DialogEventReceived", () => {
        if (!completed) setStatus("Sign-in was closed before it completed.");
      });
    });
  }

  async function signOut() {
    setStatus("Signing out…");
    await createClient().auth.signOut({ scope: "local" }).catch(() => undefined);
    setOutlookAccessToken(null);
    setAuthEmail(null);
    setAuthState("signed-out");
    setItem(null);
    setReady(false);
    setResult("");
    setStatus("Signed out of Beckett.");
  }

  return (
    <main className="min-h-screen bg-bg p-5 text-ink">
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        onLoad={() => {
          window.Office?.onReady?.((info) => {
            if (info?.host) {
              setOfficeHost(info.host);
              void readCurrentItem();
            } else {
              setOfficeHost(null);
              setStatus("Open Beckett from a received message in Outlook to begin.");
            }
          });
        }}
      />
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Beckett</p>
      <h1 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>
        Private message support
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-mid">
        Beckett reads only the Microsoft Outlook message you choose. It never changes or sends messages.
      </p>

      {!officeHost && (
        <div className="mt-4 rounded-sm border border-primary/20 bg-primary-light/30 px-3 py-3 text-xs leading-relaxed text-ink-mid">
          This page is the task pane for the Beckett add-in. Open it inside Microsoft Outlook so it can read the selected message.
        </div>
      )}

      <div className="mt-4 rounded-sm border border-border bg-white px-3 py-3 text-xs leading-relaxed text-ink-mid" role="status">
        {status}
      </div>

      {authState !== "signed-in" ? (
        <div className="mt-4 rounded-card border border-border bg-white p-4">
          <p className="text-sm font-medium text-ink">Connect your Beckett account</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mid">
            A Beckett account is required for user-invoked message coaching. Sign in or create a free account.
          </p>
          <button
            type="button"
            onClick={() => beginAccountFlow("/auth/login", "Opening secure sign-in…")}
            className="mt-3 inline-flex rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Sign in to Beckett
          </button>
          <button
            type="button"
            onClick={() => beginAccountFlow("/auth/signup", "Opening account creation…")}
            className="ml-2 mt-3 inline-flex rounded-pill border border-border px-4 py-2 text-sm text-ink hover:bg-bg"
          >
            Create account
          </button>
          {authEmail && <p className="mt-2 text-xs text-ink-light">Signed in as {authEmail}</p>}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-light">
          <p>Connected to Beckett{authEmail ? ` as ${authEmail}` : ""}.</p>
          <button type="button" onClick={() => void signOut()} className="text-primary hover:underline">
            Sign out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => void readCurrentItem()}
        disabled={!officeHost}
        className="mt-4 rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        Read selected Outlook item
      </button>

      {item && (
        <div className="mt-5 rounded-card border border-border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-light">Selected item</p>
          <h2 className="mt-1 text-base font-medium text-ink">{item.subject}</h2>
          <p className="mt-1 text-xs text-ink-mid">{item.sender || "Unknown sender"}</p>
          <button
            type="button"
            onClick={() => void decode()}
            disabled={!ready || authState !== "signed-in" || decoding}
            className="mt-4 rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {decoding ? "Decoding…" : "Decode with Beckett"}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-5 rounded-card border border-border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-primary">Beckett’s read</p>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{result}</div>
        </div>
      )}

      <div className="mt-6 flex gap-4 text-xs text-ink-light">
        <a href="/support" target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">Support</a>
        <a href="/privacy" target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">Privacy</a>
        <a href="/terms" target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">Terms</a>
      </div>
    </main>
  );
}
