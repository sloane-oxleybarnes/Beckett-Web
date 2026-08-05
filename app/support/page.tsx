import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Support - Beckett",
  description:
    "Get help with Beckett, including the Beckett for Outlook add-in.",
  alternates: { canonical: "/support" },
};

const outlookSteps = [
  "Open a message or draft in Outlook.",
  "Choose Beckett from the Outlook ribbon or Apps menu.",
  "Select Read selected item. Beckett does not read the item before this step.",
  "Select Decode with Beckett to request coaching.",
  "In a draft, choose Insert into current draft if you want to use the result. Beckett never sends the message.",
];

const troubleshooting = [
  {
    title: "Beckett asks you to sign in",
    body: "Use Sign in in a new tab, finish signing in to your approved Beckett account, return to Outlook, and select Refresh sign-in.",
  },
  {
    title: "Read selected item is unavailable",
    body: "Open the Beckett pane from an email message or draft. The command is not intended to read your mailbox in the background.",
  },
  {
    title: "Text cannot be inserted",
    body: "Insertion is available only while composing a writable draft. You can still copy the coaching result manually.",
  },
  {
    title: "The pane does not appear after installation",
    body: "Restart Outlook, then look for Beckett under Apps or the message ribbon. Organization-managed installations can take time to appear.",
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="border-b border-border bg-white/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/brand/beckett-horizontal-logo.png"
              alt="Beckett"
              width={126}
              height={32}
              priority
            />
          </Link>
          <a
            href="mailto:hello@meetbeckett.co"
            className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Email support
          </a>
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl px-5 py-12">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-primary">
          Beckett support
        </p>
        <h1
          className="mb-4 text-4xl text-ink sm:text-5xl"
          style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
        >
          Help when something does not feel clear.
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-ink-mid">
          Contact{" "}
          <a className="text-primary hover:underline" href="mailto:hello@meetbeckett.co">
            hello@meetbeckett.co
          </a>{" "}
          for account, privacy, security, or Beckett for Outlook support. Please
          do not include private message content unless our support team asks
          for a redacted example.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-5 px-5 pb-12">
        <article className="rounded-card border border-border bg-white p-6">
          <h2
            className="mb-3 text-2xl"
            style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
          >
            Using Beckett for Outlook
          </h2>
          <ol className="space-y-3">
            {outlookSteps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-mid">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-medium text-primary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </article>

        <div className="grid gap-5 sm:grid-cols-2">
          {troubleshooting.map((item) => (
            <article key={item.title} className="rounded-card border border-border bg-white p-6">
              <h2 className="mb-2 text-lg font-medium">{item.title}</h2>
              <p className="text-sm leading-relaxed text-ink-mid">{item.body}</p>
            </article>
          ))}
        </div>

        <article className="rounded-card border border-primary/20 bg-primary-light/60 p-6">
          <h2
            className="mb-3 text-2xl"
            style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
          >
            Privacy and account help
          </h2>
          <p className="text-sm leading-relaxed text-ink-mid">
            Beckett uses only the Outlook item you explicitly select. Review our{" "}
            <Link className="text-primary hover:underline" href="/privacy">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link className="text-primary hover:underline" href="/terms">
              Terms of Use
            </Link>
            . You can request account deletion from Beckett Settings or by
            emailing support.
          </p>
        </article>
      </section>
    </main>
  );
}
