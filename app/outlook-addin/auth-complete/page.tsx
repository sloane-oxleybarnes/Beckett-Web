"use client";

import Script from "next/script";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

type DialogOfficeApi = {
  onReady?: (callback: () => void) => void;
  context?: { ui?: { messageParent?: (message: string) => void } };
};

function outlookOffice() {
  return (window as typeof window & { Office?: DialogOfficeApi }).Office;
}

export default function OutlookAuthCompletePage() {
  const [status, setStatus] = useState("Finishing secure sign-in…");

  async function notifyOutlook() {
    const { data, error } = await createClient().auth.getSession();
    const accessToken = data.session?.access_token;
    if (error || !accessToken) {
      setStatus("Beckett could not find a signed-in session. Return to Outlook and try again.");
      return;
    }

    const type = new URLSearchParams(window.location.search).get("mode") === "mail"
      ? "beckett-outlook-mail-connected"
      : "beckett-outlook-auth";
    const message = JSON.stringify({ type, accessToken });
    const office = outlookOffice();
    if (!office?.context?.ui?.messageParent) {
      setStatus("Sign-in finished. Close this window, return to Outlook, and reopen Beckett.");
      return;
    }
    office.context.ui.messageParent(message);
    setStatus("Connected. You can close this window and return to Outlook.");
  }

  function initializeOffice() {
    const office = outlookOffice();
    if (office?.onReady) office.onReady(() => void notifyOutlook());
    else void notifyOutlook();
  }

  return <main className="min-h-screen bg-bg p-6 text-center text-sm text-ink-mid">
    <Script src="https://appsforoffice.microsoft.com/lib/1/hosted/Office.js" onLoad={initializeOffice} />
    <p>{status}</p>
    <button type="button" onClick={() => void notifyOutlook()} className="mt-4 rounded-pill border border-primary/30 px-4 py-2 text-primary hover:bg-primary-light">Return session to Outlook</button>
  </main>;
}
