import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Beckett is installed in Slack",
  description: "Open Beckett in Slack or optionally link your Beckett account.",
  robots: { index: false, follow: false },
};

export default function SlackInstalledPage() {
  return <main className="flex min-h-screen items-center bg-bg px-6 py-16 text-ink">
    <div className="mx-auto w-full max-w-2xl rounded-card border border-border bg-white p-8 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Installation complete</p>
      <h1 className="mt-2 text-4xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Beckett is installed in Slack</h1>
      <p className="mt-4 leading-7 text-ink-mid">Open Beckett in Slack and use the Messages tab, a message shortcut, or <code>/beckett</code>. Your guest daily allowance works immediately, and coaching responses stay in your private Beckett conversation.</p>
      <p className="mt-3 leading-7 text-ink-mid">Linking a Beckett account is optional. Link it from Slack when you want coaching to use your saved profile and share the credits included with your Beckett subscription.</p>
      <div className="mt-8 flex flex-wrap gap-4 text-sm font-medium"><Link className="text-primary hover:underline" href="/slack">Slack guide</Link><Link className="text-primary hover:underline" href="/slack/privacy">Privacy</Link><Link className="text-primary hover:underline" href="/support">Support</Link></div>
    </div>
  </main>;
}
