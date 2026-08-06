import Image from "next/image";
import Link from "next/link";
import { BECKETT_BOUNDARIES, BECKETT_COACHING_PRINCIPLE } from "@/lib/beckett-boundaries";

const sections = [
  {
    title: "What Beckett reads",
    body: [
      "During beta, Beckett can use Gmail, Google Calendar, Slack, and Chrome extension context only when you connect those tools and ask Beckett for coaching, or when you turn on an analysis setting yourself.",
      "In the Gmail add-on, Beckett uses add-on-specific access to the open message or available thread context after you choose an analysis action. If you separately connect Gmail in the Beckett web app, Beckett uses the read-only access you approve for the feature you request.",
      "For Slack, Beckett uses connected workspace context and may search relevant Slack history across authorized channels, DMs, group DMs, and private channels when you ask for coaching.",
      "For Google Calendar, Beckett uses read-only access to list the calendars you choose and to read upcoming event titles, timing, and attendees from those calendars. This lets Beckett show your day and offer meeting context. Beckett does not create, edit, cancel, or respond to calendar events during beta.",
      "Beckett is not meant to read your work communication in the background without your action.",
    ],
  },
  {
    title: "What Beckett collects and stores",
    body: [
      "Beckett stores account details, beta access status, onboarding answers, connection status, usage counts, timestamps, contacts you choose to add, coaching settings, and voluntary workday choices such as check-ins, reminder preferences, and a same-day focus when you save one. If you save or dismiss an earned learning suggestion, Beckett stores that explicit choice and the safe recommendation metadata shown to you.",
      "This can include personal information such as your name and email address, authentication and connection information, user-provided communication preferences, and workplace communication context you choose to send for coaching.",
      "Beckett does not store full Gmail or Slack message history by default, including raw Slack search results used for a coaching response. For product analytics and CRM, Beckett uses counts, timestamps, connection status, and safe event names, not raw message content.",
      "Beckett does not store Google Calendar events. We retain a Google connection credential only while you keep that connection active, and remove it when you disconnect the service or delete your account.",
      "When a selected Gmail conversation matches a confirmed Beckett contact, Beckett may store a short derived interaction summary so future coaching has continuity. Optional email-style learning is off by default and stores compact observations such as typical length or formatting, not full email bodies.",
    ],
  },
  {
    title: "How Beckett uses your data",
    body: [
      "Beckett uses user data to provide and improve its single purpose: workplace and workplace-adjacent communication coaching in Gmail, Slack, the Chrome extension, practice sessions, and skill modules.",
      "That includes authenticating your account, enforcing beta access and usage limits, generating coaching responses, remembering your preferences, connecting Gmail or Slack when you ask, troubleshooting bugs, responding to support requests, and improving coaching quality.",
      "Beckett does not use or transfer user data for purposes unrelated to workplace or workplace-adjacent communication coaching.",
      "Google data is sent to an AI provider only when it is needed to provide a coaching feature you requested. Beckett does not use Google API data to train generalized AI or machine-learning models.",
    ],
  },
  {
    title: "How your Beckett settings work across devices",
    body: [
      "Beckett keeps your core profile, coaching preferences, voluntary workday settings, contacts, connected-service choices, and selected safety-resource region in one protected account system. When a Beckett feature is available on more than one device or surface, it is designed to follow those same choices rather than create a separate version of you.",
      "Some actions always require a new confirmation at the moment you take them. These include connecting Gmail or Calendar, turning on notifications, any future calendar change, starting live meeting support, or saving meeting notes, transcripts, or audio. Beckett does not infer your location; it uses the country or region you choose for safety-resource information.",
      "During beta, Beckett lets you choose a country or region for safety-resource routing. Beckett has reviewed resource sets for the United States, Canada, the United Kingdom, and Australia. If you select another region, it will say that clearly and show an international fallback rather than imply local accuracy. Beckett stores the selected region, not precise location data.",
    ],
  },
  {
    title: "Who Beckett shares data with",
    body: [
      "Beckett shares user data only with service providers and systems needed to run, secure, support, and improve Beckett.",
      "These may include authentication and database providers such as Supabase, AI providers such as Anthropic for generating coaching responses, Google and Slack APIs when you connect those services, hosting and infrastructure providers, analytics and debugging tools, email delivery tools, and beta/customer-support tools such as HubSpot and Loops.",
      "Service providers receive only the information needed for their role. Beckett does not sell personal data or transfer user data to advertising platforms, data brokers, or other information resellers.",
    ],
  },
  {
    title: "What Beckett does not do",
    body: [
      "Beckett does not sell your personal data.",
      "Beckett does not use Gmail or Slack content for advertising.",
      "Beckett does not automatically send Gmail messages. A draft is created only after you choose a draft action, and you review and send it from Gmail.",
      "Beckett does not use or transfer user data to determine creditworthiness or for lending purposes.",
      "Beckett does not collect payment card information through the Chrome extension during beta.",
      "Beckett does not collect health information, precise location, or general web browsing history for its Chrome extension.",
      "Beckett does not connect to LinkedIn, Zoom, or Google Meet during beta.",
      "Beckett does not ask for or store your personal Anthropic API key.",
    ],
  },
  {
    title: "Google API Limited Use",
    body: [
      "Beckett's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. The Chrome extension separately adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements.",
      "Beckett uses Google API data only to provide or improve user-facing workplace and workplace-adjacent communication coaching features requested by the user.",
      "Beckett does not use Google API data for advertising, does not sell Google API data, and does not transfer Google API data except as needed to provide or improve Beckett, comply with applicable law, protect against abuse or security threats, or complete a merger, acquisition, or sale of assets with user consent where required.",
    ],
  },
  {
    title: "How Beckett protects Google data",
    body: [
      "Beckett uses HTTPS/TLS to transmit Google data and encrypts stored Google OAuth credentials using AES-256-GCM before they are written to its database. The encryption key is stored separately from the database in managed application secrets.",
      "Connection credentials are available only to Beckett's server-side services that need them to provide the connected feature. They are not exposed to the browser, included in analytics, or written to application error logs.",
      "Beckett does not permit routine human review of Google data. A team member may access specific data only with your explicit permission, when needed to investigate a security incident, or when required by law.",
    ],
  },
  {
    title: "Feedback and debugging",
    body: [
      "If you submit beta feedback, that feedback may include the page, rating, your comment, and relevant debug context.",
      "Extension feedback may include message context from the analysis you are reporting, because that helps us understand what went wrong. Only send feedback when you are comfortable sharing that context with the Beckett team.",
      "We use beta feedback to fix bugs, improve coaching quality, and decide what needs to change before inviting more users.",
    ],
  },
  {
    title: "Support, privacy, and security reports",
    body: [
      "To request help or report a privacy or security concern, email hello@meetbeckett.co.",
      "During beta, Beckett acknowledges normal support requests within one business day. Active or suspected security incidents are reviewed as soon as they are discovered.",
      "When reporting a problem, describe what happened without including private messages or coaching content unless the Beckett team specifically asks for a redacted example.",
    ],
  },
  {
    title: "Deletion during beta",
    body: [
      "You can request account deletion from Settings. During beta, deletion is handled manually so we can remove data across Beckett, Supabase, HubSpot, email tools, and related systems.",
      "Beckett currently targets completion within 30 days. If you need help, email hello@meetbeckett.co.",
    ],
  },
];

export const metadata = {
  title: "Privacy and Trust - Beckett",
  description:
    "How Beckett handles Gmail, Slack, extension context, beta feedback, deletion, and coaching boundaries.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
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
          <Link
            href="/beta"
            className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            Beta access
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl px-5 py-12">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-primary">
          Privacy and trust
        </p>
        <h1
          className="mb-4 text-4xl text-ink sm:text-5xl"
          style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
        >
          Beckett should be clear before it asks for context.
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-ink-mid">
          Beckett is a workplace and workplace-adjacent communication coach for beta users. It works best with real
          communication context, so the rules below explain what Beckett reads, what it stores,
          how it uses and shares data, what feedback can include, and where the coaching
          boundaries are.
        </p>
        <p className="mt-4 text-sm text-ink-light">Last updated: July 29, 2026</p>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-5 px-5 pb-12">
        {sections.map((section) => (
          <article key={section.title} className="rounded-card border border-border bg-white p-6">
            <h2
              className="mb-3 text-2xl text-ink"
              style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
            >
              {section.title}
            </h2>
            <div className="space-y-3">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-relaxed text-ink-mid">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        ))}

        <article className="rounded-card border border-primary/20 bg-primary-light/60 p-6">
          <h2
            className="mb-3 text-2xl text-ink"
            style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
          >
            Beckett&apos;s coaching boundaries
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-ink-mid">
            {BECKETT_COACHING_PRINCIPLE}
          </p>
          <ul className="space-y-2">
            {BECKETT_BOUNDARIES.map((boundary) => (
              <li key={boundary} className="flex gap-2 text-sm leading-relaxed text-ink-mid">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{boundary}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
