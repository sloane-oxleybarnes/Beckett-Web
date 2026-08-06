"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
export default function OutlookAuthCompletePage() {
  const [message, setMessage] = useState("Finishing sign-in…");
  useEffect(() => {
    const finish = async () => {
      const { data } = await createClient().auth.getSession();
      const accessToken = data.session?.access_token;
      const refreshToken = data.session?.refresh_token;
      if (!accessToken || !refreshToken) return setMessage("We could not confirm your sign-in. Close this window and try again.");
      const send = () => { window.Office?.context?.ui?.messageParent?.(JSON.stringify({ type: "beckett-auth-success", accessToken, refreshToken, email: data.session?.user.email || null })); setMessage("Connected. This window will close automatically."); };
      if (window.Office?.onReady) window.Office.onReady(send); else setMessage("This sign-in window did not initialize correctly. Close it and try again.");
    };
    const ready = () => void finish(); window.addEventListener("officejs-ready", ready, { once: true }); if (window.Office) void finish(); return () => window.removeEventListener("officejs-ready", ready);
  }, []);
  return <main className="min-h-screen bg-bg p-6 text-center text-sm text-ink-mid"><Script src="https://appsforoffice.microsoft.com/lib/1/hosted/Office.js" onLoad={() => window.dispatchEvent(new Event("officejs-ready"))} /><p>{message}</p></main>;
}
