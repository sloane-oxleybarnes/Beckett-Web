import type { Metadata } from "next";
import Link from "next/link";
import AddToSlackButton from "@/components/integrations/AddToSlackButton";
import { slackInstallScopes, slackUnapprovedWarning } from "@/lib/slack-install-copy";

export const metadata: Metadata = {
  title: "Review the Beckett Slack installation",
  description: "Review Beckett's beta status and Slack permissions before installation.",
  robots: { index: false, follow: false },
};

export default async function SlackInstallPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const accountConnection = mode === "connect";
  const continueHref = accountConnection ? "/api/slack/connect" : "/api/slack/install";

  return <main className="min-h-screen bg-bg px-5 py-12 text-ink">
    <div className="mx-auto max-w-3xl">
      <Link href={accountConnection ? "/dashboard/apps" : "/slack"} className="text-sm font-medium text-primary hover:underline">← Back</Link>
      <div className="mt-6 rounded-card border border-border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Final review before Slack</p>
        <h1 className="mt-2 text-4xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{accountConnection ? "Connect your Beckett account to Slack" : "Install Beckett for Slack"}</h1>
        <div className="mt-6 rounded-card border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">Slack will say “App is not approved by Slack”</h2>
          <p className="mt-2 text-sm leading-6 text-amber-950">{slackUnapprovedWarning}</p>
        </div>

        <h2 className="mt-8 text-xl font-semibold">Permissions you will be asked to approve</h2>
        <ul className="mt-4 space-y-3">
          {slackInstallScopes.map((permission) => <li key={permission.scope} className="rounded-sm border border-border p-4"><div className="flex flex-wrap items-baseline gap-2"><code className="text-xs text-primary">{permission.scope}</code><span className="font-medium">{permission.label}</span></div><p className="mt-1 text-sm leading-6 text-ink-mid">{permission.detail}</p></li>)}
        </ul>

        <div className="mt-8 rounded-sm bg-primary-light/40 p-4 text-sm leading-6 text-ink-mid">
          {accountConnection ? "After installation, Beckett will link this Slack identity to your signed-in Beckett account so Slack coaching can use your saved preferences and subscription credits." : "No Beckett account is required. The workspace installation will start with Beckett's guest allowance, and each person can optionally link an account later from Slack."}
        </div>
        <p className="mt-5 text-xs leading-5 text-ink-light">Your workspace may require administrator approval. By continuing, you will leave Beckett and review Slack&apos;s own authorization screen before anything is installed.</p>
        <div className="mt-7 flex flex-wrap items-center gap-5">
          <AddToSlackButton href={continueHref} label={accountConnection ? "Continue to connect Slack" : "Continue to Slack"} />
          <Link href={accountConnection ? "/dashboard/apps" : "/slack"} className="text-sm font-medium text-ink-mid hover:text-ink">Cancel</Link>
          <Link href="/slack/privacy" className="text-sm font-medium text-primary hover:underline">Privacy</Link>
        </div>
      </div>
    </div>
  </main>;
}
