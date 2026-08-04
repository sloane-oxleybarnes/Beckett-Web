"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

type OfficeResult = { status?: string; value?: unknown };
type OfficeItem = {
  subject?: { getAsync?: (callback: (result: OfficeResult) => void) => void };
  from?: { getAsync?: (callback: (result: OfficeResult) => void) => void };
  body?: {
    getAsync?: (coercion: string, callback: (result: OfficeResult) => void) => void;
    setSelectedDataAsync?: (
      value: string,
      options: { coercionType: string },
      callback: (result: OfficeResult) => void,
    ) => void;
  };
};
type OfficeApi = {
  context?: { mailbox?: { item?: OfficeItem } };
  onReady?: (callback: (info?: { host?: string }) => void) => void;
  CoercionType: { Text: string };
  AsyncResultStatus: { Succeeded: string };
};

declare global {
  interface Window {
    Office?: OfficeApi;
  }
}

type AuthState = "checking" | "signed-in" | "signed-out" | "unknown";

function signInUrl() {
  return `/auth/login?next=${encodeURIComponent("/outlook-addin")}`;
}

export default function OutlookAddinPage() {
  const [item, setItem] = useState<{ subject: string; sender: string; body: string } | null>(null);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("Open a message or draft in Outlook to begin.");
  const [ready, setReady] = useState(false);
  const [canInsert, setCanInsert] = useState(false);
  const [officeHost, setOfficeHost] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authEmail, setAuthEmail] = useState<string | null>(null);

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

  function readCurrentItem() {
    const office = window.Office;
    const current = office?.context?.mailbox?.item;
    if (!office || !current) {
      setStatus("Open a message or draft in Outlook to begin.");
      return;
    }

    current.subject?.getAsync?.((subjectResult) => {
      const subject = typeof subjectResult.value === "string" ? subjectResult.value : "(no subject)";
      current.from?.getAsync?.((fromResult) => {
        const from =
          fromResult.value && typeof fromResult.value === "object"
            ? (fromResult.value as { emailAddress?: string; displayName?: string })
            : {};
        const sender = from.emailAddress || from.displayName || "";
        current.body?.getAsync?.(office.CoercionType.Text, (bodyResult) => {
          if (bodyResult?.status !== office.AsyncResultStatus.Succeeded) {
            setStatus("Beckett could not read this item. Try opening it in the reading pane.");
            return;
          }
          setItem({ subject, sender, body: String(bodyResult.value || "").slice(0, 18_000) });
          setCanInsert(Boolean(current.body?.setSelectedDataAsync));
          setReady(true);
          setStatus("Ready. Beckett will only use this selected item for the next action.");
        });
      });
    });
  }

  async function decode() {
    if (!item) return;
    setStatus("Reading this message privately…");
    const response = await fetch("/api/microsoft/mail/decode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: item.body, subject: item.subject, sender: item.sender }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setAuthState("signed-out");
      setStatus("Sign in to Beckett in a new tab, then return here and try again.");
      return;
    }
    if (!response.ok) {
      setStatus(data.error || "Could not decode this item.");
      return;
    }
    setResult(data.result || "");
    setStatus("Decode complete. Nothing was sent or saved.");
  }

  function insertDraft() {
    const office = window.Office;
    const current = office?.context?.mailbox?.item;
    if (!office || !current?.body?.setSelectedDataAsync || !result) return;
    current.body.setSelectedDataAsync(result, { coercionType: office.CoercionType.Text }, (response) => {
      setStatus(
        response?.status === office.AsyncResultStatus.Succeeded
          ? "Inserted into the draft. Review it before sending."
          : "This item is not a writable draft.",
      );
    });
  }

  return (
    <main className="min-h-screen bg-bg p-5 text-ink">
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/Office.js"
        onLoad={() => {
          window.Office?.onReady?.((info) => {
            setOfficeHost(info?.host || "Outlook");
            readCurrentItem();
          });
        }}
      />
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Beckett for Outlook</p>
      <h1 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>
        Private message support
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-mid">
        Beckett reads only the Outlook item you choose. It never sends messages for you.
      </p>

      {!officeHost && (
        <div className="mt-4 rounded-sm border border-primary/20 bg-primary-light/30 px-3 py-3 text-xs leading-relaxed text-ink-mid">
          This page is the Outlook task pane. Open it from the Beckett add-in inside Outlook so it can read the selected message or draft.
        </div>
      )}

      <div className="mt-4 rounded-sm border border-border bg-white px-3 py-3 text-xs leading-relaxed text-ink-mid" role="status">
        {status}
      </div>

      {authState !== "signed-in" ? (
        <div className="mt-4 rounded-card border border-border bg-white p-4">
          <p className="text-sm font-medium text-ink">Connect your Beckett account</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mid">
            Sign in once so Beckett can use your existing Microsoft connection for this user-invoked decode.
          </p>
          <a
            href={signInUrl()}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Sign in to Beckett
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-2 mt-3 inline-flex rounded-pill border border-border px-4 py-2 text-sm text-ink hover:bg-bg"
          >
            Refresh sign-in
          </button>
          {authEmail && <p className="mt-2 text-xs text-ink-light">Signed in as {authEmail}</p>}
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-light">Connected to Beckett{authEmail ? ` as ${authEmail}` : ""}.</p>
      )}

      <button
        type="button"
        onClick={readCurrentItem}
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
            disabled={!ready || authState !== "signed-in"}
            className="mt-4 rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Decode with Beckett
          </button>
        </div>
      )}

      {result && (
        <div className="mt-5 rounded-card border border-border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-primary">Beckett’s read</p>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{result}</div>
          <button
            type="button"
            onClick={insertDraft}
            disabled={!canInsert}
            className="mt-4 rounded-pill border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            Insert into current draft
          </button>
          {!canInsert && <p className="mt-2 text-xs text-ink-light">Open a draft to insert a response. Beckett will never send it.</p>}
        </div>
      )}
    </main>
  );
}
