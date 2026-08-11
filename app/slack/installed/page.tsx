import Link from "next/link";

export default function SlackInstalledPage() {
  return <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
    <h1 className="text-3xl font-semibold">Beckett is installed in Slack</h1>
    <p className="mt-4 text-slate-700">Open Beckett in Slack and use the Messages tab, a message shortcut, or <code>/beckett</code>. Your free daily allowance works immediately.</p>
    <p className="mt-3 text-slate-700">Linking a Beckett account is optional. Link it when you want Slack usage to share your Beckett subscription and credits.</p>
    <div className="mt-8 flex gap-4"><Link className="underline" href="/dashboard/settings">Manage Beckett</Link><Link className="underline" href="/slack/privacy">Privacy</Link><a className="underline" href="mailto:hello@meetbeckett.co">Support</a></div>
  </main>;
}
