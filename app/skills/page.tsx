import Nav from "@/components/marketing/Nav";
import Footer from "@/components/marketing/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Skills", description: "Workplace communication skill courses available now and coming during the Beckett beta.", alternates: { canonical: "/skills" } };

const available = [
  { title: "Introducing yourself to a new colleague", description: "Build a natural introduction that shares what is useful about how you work without over-explaining.", sessions: 5, icon: "👋" },
  { title: "Asking your manager for clarity", description: "Turn a vague assignment into specific questions, shared expectations, and a workable next step.", sessions: 5, icon: "🔎" },
];
const coming = [
  { title: "Giving and receiving feedback", icon: "💬" },
  { title: "Navigating conflict", icon: "🤝" },
  { title: "Saying no and setting limits", icon: "🛑" },
  { title: "Asking for workplace support", icon: "🙋" },
  { title: "Written communication", icon: "✍️" },
];

export default function SkillsPage() {
  return <main className="min-h-screen bg-bg"><Nav /><div className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6">
    <div className="mb-14 text-center"><h1 className="mb-4 text-4xl text-ink sm:text-5xl" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Workplace communication skills</h1><p className="mx-auto max-w-2xl text-lg text-ink-mid">Short, practical courses for the work conversations where subtext and unwritten rules get in the way.</p></div>
    <section><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wide text-primary">Available now</p><h2 className="mt-1 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Start during beta</h2></div><span className="rounded-pill bg-green-50 px-3 py-1 text-xs font-medium text-green-700">Included</span></div><div className="grid gap-6 md:grid-cols-2">{available.map((skill) => <article key={skill.title} className="flex flex-col rounded-card border border-border bg-white p-7"><div className="text-3xl" aria-hidden="true">{skill.icon}</div><p className="mt-4 text-xs font-medium uppercase tracking-wide text-green-700">Available now · {skill.sessions} activities</p><h3 className="mt-2 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{skill.title}</h3><p className="mt-2 flex-1 text-sm leading-relaxed text-ink-mid">{skill.description}</p></article>)}</div></section>
    <section className="mt-14"><p className="text-xs font-medium uppercase tracking-wide text-primary">Coming during beta</p><h2 className="mt-1 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>More skills are on the way</h2><p className="mt-2 max-w-2xl text-sm text-ink-mid">These modules are planned and may change as beta testers help us refine the curriculum.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{coming.map((skill) => <article key={skill.title} className="rounded-card border border-dashed border-border bg-white/70 p-5"><span className="text-2xl" aria-hidden="true">{skill.icon}</span><h3 className="mt-3 font-medium text-ink">{skill.title}</h3><p className="mt-1 text-xs text-ink-light">Coming during beta</p></article>)}</div></section>
    <div className="mt-14 rounded-card border border-primary/20 bg-primary-light p-8 text-center"><h2 className="text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>All available courses are included</h2><p className="mx-auto mt-2 max-w-xl text-sm text-ink-mid">Course activities do not use your daily or monthly coaching credits.</p><Link href="/auth/signup" className="mt-6 inline-block rounded-pill bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary-dark">Create your beta account</Link></div>
  </div><Footer /></main>;
}
