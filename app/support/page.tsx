import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Support - Beckett",
  description:
    "Get help with Beckett in Google Workspace, Slack, Microsoft 365, and Chrome, including connection status, analysis, drafts, and privacy.",
  alternates: { canonical: "/support" },
};

const gmailSteps = [
  "Install Beckett from the Google Workspace Marketplace and approve the requested Gmail add-on permissions.",
  "Open a Gmail conversation, then choose Beckett from the right-hand sidebar.",
  "Sign in to or create your Beckett account. If your Gmail and Beckett addresses differ, review both addresses and confirm the connection.",
  "Choose Analyze selected conversation. Beckett reads only the conversation you selected after you request analysis.",
  "Choose Help me reply to see three approaches. You can add an instruction and update the suggestions.",
  "Choose Use in Gmail draft to create an editable reply draft. Review and send it yourself; Beckett never sends email.",
];

const outlookSteps = [
  "Open a message or draft in Outlook.",
  "Choose Beckett from the Outlook ribbon or Apps menu.",
  "Connect your Microsoft account. If seamless Microsoft sign-in is unavailable, choose Sign in to Beckett and finish in the secure Outlook dialog.",
  "Choose Analyze message. Beckett reads and processes only the message or draft you selected.",
  "Optional: choose Analyze full thread and approve Microsoft's read-only Mail.Read permission to analyze that selected conversation.",
  "Copy a response, insert it into an open draft, or open a reply with it. Review and send it yourself; Beckett never sends email.",
];

const slackSteps = [
  "Open the Beckett for Slack page, review the beta warning and six bot permissions, then choose Install Beckett for Slack.",
  "Slack currently displays “App is not approved by Slack” because Beckett has not completed Marketplace review. Installation can still continue; some workspaces require an administrator to approve it.",
  "Select the workspace and approve commands, chat:write, assistant:write, im:history, im:write, and users:read. Beckett does not request user tokens, workspace search, or channel-history scopes.",
  "Use /beckett or a Beckett message action. Beckett routes the coaching to your private Beckett conversation instead of posting the result in the source channel.",
  "A Beckett account is optional. Guest credits work immediately; link an account later if you want Slack coaching to use your saved preferences and subscription credits.",
  "Return to Beckett Apps to add another workspace, reconnect or upgrade a connection, or unlink your account without uninstalling Beckett for other workspace members.",
];

const calendarSteps = [
  "Open Beckett Apps and choose Google Workspace or Microsoft Calendar.",
  "Connect only the calendar capability you want. Gmail and Google Calendar can be connected independently.",
  "Choose which calendars Beckett may read. Beckett does not edit events.",
  "Open Calendar in Beckett to view your week and prepare for meetings with other attendees.",
];

const troubleshooting = [
  {
    title: "Gmail asks you to connect an account",
    body: "Open the secure connection link, sign in to Beckett, confirm the Gmail account shown, then return to Gmail and reopen Beckett. If the addresses differ, Beckett asks you to approve the connection explicitly.",
  },
  {
    title: "Analysis is unavailable",
    body: "Open an individual Gmail conversation before opening Beckett. Beckett does not read the inbox in the background and only analyzes a conversation after you request it.",
  },
  {
    title: "Gmail draft permission is required",
    body: "Analysis can work without draft access. To use Use in Gmail draft, approve the additional Gmail draft permission when prompted, then try the action again. Beckett creates an editable draft and never sends it.",
  },
  {
    title: "Credit limit reached",
    body: "Your current Beckett allowance has been used. Check your account or plan in Beckett, then try again after credits are available. Existing Gmail messages and drafts are not changed.",
  },
  {
    title: "Outlook asks you to sign in",
    body: "Try Connect Microsoft account first. If Microsoft SSO is unavailable for that mailbox, choose Sign in to Beckett and complete sign-in in the secure Outlook dialog. The pane updates automatically.",
  },
  {
    title: "Analyze message is unavailable",
    body: "Open the Beckett pane from an email message or draft and finish sign-in. Beckett does not read your mailbox in the background.",
  },
  {
    title: "Full-thread analysis asks for permission",
    body: "Analyze full thread uses Microsoft's delegated, read-only Mail.Read permission. Approve it in the Microsoft window, return to Outlook, and choose Analyze full thread again.",
  },
  {
    title: "Text cannot be inserted",
    body: "Insertion is available only while composing a writable draft. You can still copy the coaching result manually.",
  },
  {
    title: "The pane does not appear after installation",
    body: "Restart Outlook, then look for Beckett under Apps or the message ribbon. Organization-managed installations can take time to appear.",
  },
  {
    title: "An app shows the wrong connection state",
    body: "Return to Beckett Apps and refresh the page. Google Workspace may be partially connected, so Gmail and Calendar can show different capability states inside one app card.",
  },
  {
    title: "Slack says reconnect or degraded",
    body: "Open Beckett Apps, choose Manage workspaces on the Slack card, and reconnect the affected workspace. You can unlink an old connection without uninstalling Beckett for anyone else.",
  },
  {
    title: "Slack says the app is not approved",
    body: "That notice means Beckett has not completed Slack Marketplace review. During the public beta, review the listed permissions and continue only if you are comfortable. If installation is blocked, ask a workspace owner or administrator to approve Beckett.",
  },
  {
    title: "A Slack connection needs an upgrade",
    body: "Open Beckett Apps, choose Manage workspaces, and select Upgrade/relink for the affected workspace. The new zero-copy connection uses six bot permissions and does not request workspace search or broad channel history.",
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
          for account, privacy, security, or connected-app
          support. Please
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
            Using Beckett for Gmail
          </h2>
          <ol className="space-y-3">
            {gmailSteps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-mid">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-medium text-primary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="rounded-card border border-border bg-white p-6">
          <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Using Beckett in Slack</h2>
          <ol className="space-y-3">{slackSteps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-mid"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-medium text-primary">{index + 1}</span><span>{step}</span></li>)}</ol>
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium"><Link href="/slack" className="text-primary hover:underline">Beckett for Slack installation guide</Link><Link href="/slack/privacy" className="text-primary hover:underline">Slack privacy details</Link></div>
        </article>

        <article className="rounded-card border border-border bg-white p-6">
          <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Connecting calendars</h2>
          <ol className="space-y-3">{calendarSteps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-mid"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-medium text-primary">{index + 1}</span><span>{step}</span></li>)}</ol>
        </article>

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
            Beckett processes Gmail or Outlook content only after you choose the
            relevant analysis action. Optional Gmail email-style learning is off by
            default and can be changed from the Beckett add-on home. Review our{" "}
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

        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/apps" className="rounded-pill bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">Return to Apps</Link>
          <Link href="/dashboard" className="rounded-pill border border-border bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-primary-light">Return to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
