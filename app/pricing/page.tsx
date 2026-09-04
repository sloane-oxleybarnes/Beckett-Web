import Nav from "@/components/marketing/Nav";
import Footer from "@/components/marketing/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beta Pricing",
  description: "Beckett is free during public beta, with clear daily and monthly coaching limits.",
  alternates: { canonical: "/pricing" },
};

const betaFeatures = [
  "60 successful coaching actions per day",
  "500 successful coaching actions per month",
  "Gmail, Slack, Outlook, Calendar, and Chrome coaching",
  "Full standalone conversation Practice",
  "All currently available skill courses",
  "Course activities do not use coaching credits",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-bg">
      <Nav />
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-32 sm:px-6">
        <div className="mb-14 text-center">
          <h1 className="mb-4 text-4xl text-ink sm:text-5xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Free during public beta</h1>
          <p className="mx-auto max-w-2xl text-lg text-ink-mid">Use every feature currently available, help us learn what works, and see upcoming capabilities as they arrive.</p>
        </div>
        <section className="mx-auto max-w-2xl rounded-card border border-primary bg-primary p-8 shadow-lg shadow-primary/10">
          <p className="text-sm font-medium uppercase tracking-wide text-white/70">Public beta</p>
          <div className="mt-2 flex items-baseline gap-2"><span className="text-4xl font-semibold text-white">Free</span><span className="text-sm text-white/70">during beta</span></div>
          <p className="mt-3 text-sm text-white/80">Create an account immediately. No invitation, approval wait, or credit card is required.</p>
          <ul className="my-8 grid gap-3 sm:grid-cols-2">{betaFeatures.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-white/90"><span aria-hidden="true">✓</span><span>{feature}</span></li>)}</ul>
          <Link href="/auth/signup" className="block rounded-pill bg-white py-3 text-center text-sm font-medium text-primary hover:bg-primary-light">Create your beta account</Link>
        </section>
        <section className="mx-auto mt-8 max-w-2xl rounded-card border border-border bg-white p-6 text-center">
          <h2 className="text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>After beta</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-mid">Post-beta plans and limits are still being tested. We will share clear pricing before anything changes; the plans shown here are the only current offer.</p>
        </section>
      </div>
      <Footer />
    </main>
  );
}
