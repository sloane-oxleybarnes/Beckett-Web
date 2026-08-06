"use client";

import { useState } from "react";

export default function GoogleWorkspaceAddonConnectForm({
  token,
  googleEmail,
  beckettEmail,
}: {
  token: string;
  googleEmail: string;
  beckettEmail: string;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function connect() {
    setStatus("saving");
    setError("");
    const response = await fetch("/api/google-workspace-addon/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(
        data.error === "google_account_already_linked"
          ? "This Google account is already connected to another Beckett account."
          : data.error === "link_expired"
            ? "This connection link expired. Reopen Beckett in Gmail to create a new one."
            : "Beckett could not connect these accounts. Please try again.",
      );
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="rounded-card border border-primary/20 bg-primary-light p-5">
        <h2 className="mb-2 text-lg text-ink">Accounts connected</h2>
        <p className="text-sm leading-relaxed text-ink-mid">
          Return to Gmail, close and reopen Beckett, and then analyze the email you choose.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-border bg-bg p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-light">Google account</p>
          <p className="break-words text-sm text-ink">{googleEmail}</p>
        </div>
        <div className="rounded-card border border-border bg-bg p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-light">Beckett account</p>
          <p className="break-words text-sm text-ink">{beckettEmail}</p>
        </div>
      </div>

      {googleEmail.toLowerCase() !== beckettEmail.toLowerCase() && (
        <p className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink-mid">
          These email addresses are different. Connecting them lets this Google account use the coaching profile, contacts, and preferences in the Beckett account shown above.
        </p>
      )}

      {status === "error" && (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="button"
        onClick={connect}
        disabled={status === "saving"}
        className="w-full rounded-pill bg-primary px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {status === "saving" ? "Connecting…" : "Connect these accounts"}
      </button>
      <p className="text-center text-xs leading-relaxed text-ink-light">
        Beckett will not read or send email from this page. Gmail content is only processed after you use an action inside the add-on.
      </p>
    </div>
  );
}
