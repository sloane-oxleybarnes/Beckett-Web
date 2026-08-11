import Link from "next/link";

const supportTopics = [
  {
    title: "Microsoft Outlook add-in help",
    body: "Open a received message in Microsoft Outlook, choose Beckett from the message command bar, sign in to your Beckett account, and select Decode with Beckett. The Beckett add-in is read-only: it does not modify or send mail.",
  },
  {
    title: "Account access",
    body: "You can sign in, create an account, or request beta access from the Outlook task pane. If sign-in does not complete, close the dialog, reopen Beckett, and try again.",
  },
  {
    title: "Privacy and security",
    body: "Please do not email private message content when reporting a problem unless the Beckett team asks for a redacted example. Security and privacy reports are reviewed as soon as they are received.",
  },
  {
    title: "Account deletion",
    body: "Request account deletion from Beckett Settings or contact support. During beta, Beckett targets completion within 30 days across its connected service providers.",
  },
];

export const metadata = {
  title: "Support - Beckett",
  description: "Get help with Beckett, including its add-in for Microsoft Outlook, account access, privacy, and deletion requests.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="border-b border-border bg-white/80">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>
            Beckett
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/privacy" className="text-primary hover:underline">Privacy</Link>
            <Link href="/terms" className="text-primary hover:underline">Terms</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl px-5 py-12">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-primary">Beckett support</p>
        <h1 className="text-4xl text-ink sm:text-5xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>
          How can we help?
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-mid">
          Email <a className="text-primary hover:underline" href="mailto:hello@meetbeckett.co">hello@meetbeckett.co</a> for product, account, privacy, or security support. During beta, normal support requests are acknowledged within one business day.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-5 px-5 pb-12 sm:grid-cols-2">
        {supportTopics.map((topic) => (
          <article key={topic.title} className="rounded-card border border-border bg-white p-6">
            <h2 className="text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{topic.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-mid">{topic.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
