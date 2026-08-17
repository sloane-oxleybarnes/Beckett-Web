import type { Metadata } from "next";
import Link from "next/link";
import AddToSlackButton from "@/components/integrations/AddToSlackButton";
import Footer from "@/components/marketing/Footer";
import Nav from "@/components/marketing/Nav";
import { slackInstallScopes, slackUnapprovedWarning } from "@/lib/slack-install-copy";

export const metadata: Metadata = {
  title: "Beckett for Slack",
  description: "Install Beckett's private, zero-copy workplace communication coaching in Slack.",
  alternates: { canonical: "/slack" },
};

const coachingTools = [
  ["Decode", "Separate what a message clearly says from uncertain tone and possible interpretations."],
  ["Respond", "Draft a clear reply while keeping the final decision and send action with you."],
  ["Rewrite", "Make your own draft clearer, warmer, more direct, or more concise."],
  ["Prep", "Prepare for a difficult conversation without storing the Slack conversation in Beckett."],
  ["Practice", "Rehearse the conversation privately with realistic follow-up and pushback."],
] as const;

export default function SlackPage() {
  return (
    <main className="min-h-screen bg-bg text-ink">
      <Nav />
      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-32 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Beckett for Slack · Public beta</p>
          <h1 className="mt-4 text-5xl leading-[1.05] sm:text-6xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>
            Communication coaching<br /><em className="text-primary">inside Slack.</em>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-mid">
            Privately decode messages, draft replies, rewrite what you want to say, and prepare or practice difficult workplace conversations without copying a Slack transcript into Beckett.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <AddToSlackButton href="/slack/install" label="Install Beckett for Slack" />
            <p className="max-w-sm text-sm leading-6 text-ink-mid">No Beckett account required. Your guest allowance works immediately; account linking is optional.</p>
          </div>
        </div>

        <aside className="rounded-card border border-amber-300 bg-amber-50 p-6 shadow-sm" aria-labelledby="slack-beta-warning">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">What Slack will show</p>
          <h2 id="slack-beta-warning" className="mt-2 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>“App is not approved by Slack”</h2>
          <p className="mt-3 text-sm leading-6 text-amber-950">{slackUnapprovedWarning}</p>
          <p className="mt-4 text-xs leading-5 text-amber-900">Some workspaces require an administrator to approve every app. If Slack blocks the installation, ask your workspace owner or administrator to approve Beckett.</p>
        </aside>
      </section>

      <section className="border-y border-border bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">What you can do</p>
          <h2 className="mt-2 text-4xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Five private coaching flows</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {coachingTools.map(([title, detail]) => <article key={title} className="rounded-card border border-border bg-bg/50 p-5"><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-mid">{detail}</p></article>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Six bot permissions</p>
            <h2 className="mt-2 text-4xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Only what the beta uses</h2>
            <p className="mt-4 text-sm leading-6 text-ink-mid">Beckett does not request user tokens, workspace search, public-channel history, private-channel history, or group-DM history. A workspace administrator can review every permission before approving installation.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {slackInstallScopes.map((permission) => <article key={permission.scope} className="rounded-card border border-border bg-white p-5"><code className="rounded bg-primary-light px-2 py-1 text-xs text-primary">{permission.scope}</code><h3 className="mt-3 font-semibold">{permission.label}</h3><p className="mt-1 text-sm leading-6 text-ink-mid">{permission.detail}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-primary-light/45">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-16 md:grid-cols-3">
          <article className="rounded-card bg-white p-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">Private by design</p><h2 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Your coaching stays with you</h2><p className="mt-3 text-sm leading-6 text-ink-mid">Slash commands and message shortcuts open private Beckett coaching. Beckett does not post the coaching result into the source channel.</p></article>
          <article className="rounded-card bg-white p-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">Zero-copy</p><h2 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Slack keeps the transcript</h2><p className="mt-3 text-sm leading-6 text-ink-mid">Beckett processes only what you select or send when you request help, then re-reads the exact private Beckett thread from Slack when needed.</p></article>
          <article className="rounded-card bg-white p-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">Credits</p><h2 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Start as a guest</h2><p className="mt-3 text-sm leading-6 text-ink-mid">Unlinked users receive a limited daily allowance. Link a Beckett account later when you want Slack usage to share the credits included with your Beckett subscription.</p></article>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h2 className="text-4xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Ready to test Beckett in your workspace?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink-mid">You will review the beta warning and permissions once more before Slack opens. Installing does not create a Beckett account.</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-5"><AddToSlackButton href="/slack/install" label="Install Beckett for Slack" /><Link href="/slack/privacy" className="text-sm font-medium text-primary hover:underline">Read the Slack privacy details</Link><Link href="/support" className="text-sm font-medium text-primary hover:underline">Installation help</Link></div>
      </section>
      <Footer />
    </main>
  );
}
