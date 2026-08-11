import Link from "next/link";

export const metadata = {
  title: "Beckett for Slack Privacy",
  description: "How the zero-copy Beckett Slack app processes and protects Slack data.",
};

const sections = [
  ["What Beckett processes", "Beckett processes a message you select, text you send to Beckett, or the exact private Beckett thread only when you request coaching. It may send that transient content to Beckett's AI provider to generate the response you requested."],
  ["What Beckett stores", "Slack remains the transcript system of record. Beckett does not persist Slack messages, prompts, generated responses, transcripts, workspace search results, participant names, channel names, or content-derived titles and summaries. Beckett stores encrypted installation credentials, opaque Slack routing identifiers, flow status, optional Beckett account links, and content-free credit and operational usage events."],
  ["Access and scope", "The zero-copy launch uses bot-only access for commands, private Beckett messages, the exact Beckett DM thread, App Home, and Slack user identity. It does not request user tokens, search the workspace, or request public-channel, private-channel, or group-DM history scopes."],
  ["Credits and account linking", "A Beckett account is not required to install or start using the app. Unlinked users receive a limited daily allowance. Linking is optional and lets Slack usage share the daily credits included with the user's Beckett subscription."],
  ["Sharing and training", "Beckett shares transient request content only with processors needed to provide and secure the requested coaching. Beckett does not sell Slack data, use it for advertising, or use it to train general-purpose models."],
  ["Control and deletion", "Workspace administrators can uninstall Beckett from Slack. Uninstall and token-revocation events invalidate stored credentials. Users can unlink their Beckett account or request deletion by emailing hello@meetbeckett.co."],
];

export default function SlackPrivacyPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-slate-900">
    <p className="text-sm font-medium uppercase tracking-wide text-amber-700">Beckett for Slack</p>
    <h1 className="mt-3 text-4xl font-semibold">Privacy</h1>
    <p className="mt-4 text-slate-600">Last updated: August 11, 2026</p>
    <div className="mt-10 space-y-8">
      {sections.map(([title, body]) => <section key={title}>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 leading-7 text-slate-700">{body}</p>
      </section>)}
    </div>
    <p className="mt-12 text-sm text-slate-600">Questions: <a className="underline" href="mailto:hello@meetbeckett.co">hello@meetbeckett.co</a></p>
    <nav className="mt-6 flex gap-4 text-sm"><Link className="underline" href="/terms">Terms</Link><a className="underline" href="mailto:hello@meetbeckett.co">Support</a></nav>
  </main>;
}
