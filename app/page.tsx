"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./home.css";

const features = [
  { n: "01", title: "Coaching in your work apps", text: "Decode and respond from Gmail, Slack, Outlook, and supported pages in Chrome. Bring Beckett into the conversation instead of copying your work into another app.", action: "Connect your apps →" },
  { n: "02", title: "Message decoder", text: "Separate what a message clearly says from uncertain tone, possible interpretations, and useful next steps.", action: "Decode a message →" },
  { n: "03", title: "Draft clearer replies", text: "Start with a response in your voice, adjust the tone, and decide what to send. Beckett never sends on your behalf.", action: "Draft a reply →" },
  { n: "04", title: "Conversation practice", text: "Rehearse the difficult conversation before it happens, including realistic questions, resistance, and follow-up.", action: "Practice a conversation →" },
  { n: "05", title: "Calendar and meeting prep", text: "Connect only the calendars you want Beckett to read and prepare for meetings with other attendees. Beckett never edits events.", action: "Prepare for a meeting →" },
  { n: "06", title: "Skills and support plans", text: "Build practical workplace communication skills in short courses, with more modules arriving during beta.", action: "Explore skills →" },
];

const workPatterns = [
  { label: "I go blank in meetings and lose what I was about to say", beckett: "Helps you prepare talking points so you are not starting from scratch in the room." },
  { label: "I cannot tell if a Slack message is passive-aggressive or just blunt", beckett: "Highlights observable cues, names uncertainty, and offers a grounded way to respond." },
  { label: "I overthink every email before I can hit send", beckett: "Drafts a response you can adjust without leaving Gmail or Outlook." },
  { label: "I shut down when I receive critical feedback", beckett: "Helps you process the message, identify the ask, and prepare a response when you are ready." },
];

const practiceConversations = [
  { label: "New colleague", situation: "Introduce yourself and explain how you work without over-scripting it." },
  { label: "Vague assignment", situation: "Ask your manager for clearer expectations without over-apologizing." },
  { label: "Difficult feedback", situation: "Respond to critical feedback while staying grounded and specific." },
  { label: "Scope pressure", situation: "Push back on an unrealistic deadline without sounding uncooperative." },
  { label: "Credit for your work", situation: "Address a coworker who presented your contribution as their own." },
  { label: "Salary conversation", situation: "Ask for a raise and respond when your manager pushes back." },
];

export default function HomePage() {
  const [activeSection, setActiveSection] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get("error_description");
      if (errorDesc) router.push(`/auth/login?error=${encodeURIComponent(errorDesc)}`);
    }
  }, [router]);

  useEffect(() => {
    const sections = ["features", "triggers", "skills", "beta"];
    function onScroll() {
      let current = "";
      sections.forEach((id) => {
        const element = document.getElementById(id);
        if (element && window.scrollY >= element.offsetTop - 120) current = id;
      });
      setActiveSection(current);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="lumen-home">
      <nav className="hn-nav">
        <a href="#" className="nav-logo nav-logo-img"><Image src="/brand/beckett-horizontal-logo.png" alt="Beckett" width={132} height={33} priority /></a>
        <div className="nav-right">
          <div className="nav-links">
            <a href="#features" className={activeSection === "features" ? "active" : ""}>Features</a>
            <a href="#skills" className={activeSection === "skills" ? "active" : ""}>Practice</a>
            <a href="/auth/login" className="nav-signin">Sign in</a>
          </div>
          <a href="/auth/signup" className="nav-cta">Join the beta →</a>
          <button className="nav-hamburger" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileMenuOpen} aria-controls="homepage-mobile-navigation">
            {mobileMenuOpen ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg> : <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>}
          </button>
        </div>
        {mobileMenuOpen && <div id="homepage-mobile-navigation" className="nav-mobile-menu"><a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a><a href="#skills" onClick={() => setMobileMenuOpen(false)}>Practice</a><a href="/auth/login">Sign in</a><a href="/auth/signup" className="nav-cta-mobile">Join the beta →</a></div>}
      </nav>

      <section className="hero">
        <div className="beta-badge"><span className="bb-dot" aria-hidden="true" />Public beta · Everything included · No credit card</div>
        <h1>Communication coaching<br /><em>inside the apps where you work.</em></h1>
        <p className="hero-sub">Beckett helps you decode tone, draft replies, and prepare for difficult conversations in Gmail, Slack, Outlook, and Chrome—without pulling every conversation into another app.</p>
        <div className="hero-actions"><a href="/auth/signup" className="btn-primary">Create your free beta account</a><a href="/slack" className="btn-secondary">Install Beckett for Slack</a></div>
        <div className="hero-visual">
          <div className="browser-frame">
            <div className="browser-chrome"><div className="b-dots"><span className="dot-r" /><span className="dot-y" /><span className="dot-g" /></div><div className="b-url">mail.google.com — Inbox</div></div>
            <div className="browser-body">
              <div className="email-pane"><div className="e-from">Sarah Chen · Director of Product</div><div className="e-subject">Re: Q3 roadmap alignment</div><div className="e-date">Today at 2:14 PM</div><div className="e-body"><p>Per my last email, I wanted to make sure we&apos;re on the same page before the all-hands.</p><div className="e-highlight">&ldquo;Let&apos;s make sure decisions like this go through the right channels going forward.&rdquo;</div><p>Looking forward to syncing on this.</p></div></div>
              <div className="b-sidebar"><div className="b-header"><div className="b-logo"><Image src="/brand/beckett-horizontal-logo.png" alt="Beckett" width={92} height={23} /></div><div className="b-status">Connected</div></div><div className="b-controls"><button type="button" tabIndex={-1} aria-hidden="true" className="b-control-primary">Analyze email</button><button type="button" tabIndex={-1} aria-hidden="true" className="b-control-secondary">Auto off</button></div><div className="i-card"><div className="i-label">Beckett read</div><div className="i-text">Sarah is flagging process frustration, not attacking you. Acknowledge the miss and confirm the next channel.</div></div><div className="r-section-label">Suggested replies</div><div className="r-card"><div className="r-tag t-direct">Direct but kind</div><div className="r-text">Thanks for flagging. I&apos;ll route decisions like this through you first going forward.</div></div><div className="r-card"><div className="r-tag t-warm">Warmer</div><div className="r-text">Appreciate the note, Sarah. I understand the process piece and will loop you in earlier next time.</div></div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="features"><div className="container"><div className="sec-label">What Beckett does</div><h2>Support that meets you<br /><em>inside the workday.</em></h2><div className="feat-grid feat-grid-5">{features.map((feature) => <div key={feature.n} className="feat-card"><div className="feat-num">{feature.n}</div><div className="feat-title">{feature.title}</div><div className="feat-text">{feature.text}</div><div className="feat-action">{feature.action}</div></div>)}</div></div></section>

      <section className="triggers-section" id="triggers"><div className="container"><div className="sec-label">Your brain, your rules</div><h2>Built around the way<br /><em>your brain actually works.</em></h2><p className="sec-sub">Beckett gives you a useful next step without pretending uncertain tone is fact or forcing you into a generic script.</p><div className="trigger-grid">{workPatterns.map((pattern) => <div key={pattern.label} className="trigger-card"><div className="tc-quote">&ldquo;{pattern.label}&rdquo;</div><div className="tc-response">{pattern.beckett}</div></div>)}</div></div></section>

      <div className="plat-wrap"><div className="container"><div className="sec-label">One coach across your work apps</div><h2>Stay in the conversation.<br /><em>Bring Beckett with you.</em></h2><p className="sec-sub">Connect only what you want. Google Workspace capabilities can be connected separately, so Gmail coaching does not require Calendar access.</p><div className="plat-grid">{[
        { icon: "pi-gmail", letter: "G", name: "Google Workspace", desc: "Decode Gmail threads and, separately, use selected calendars for meeting preparation.", status: "Available in beta" },
        { icon: "pi-slack", letter: "S", name: "Slack", desc: "Get private decoding, response help, rewriting, preparation, and practice inside Slack.", status: "Available in beta" },
        { icon: "pi-meet", letter: "O", name: "Microsoft 365", desc: "Work with selected Outlook messages and calendars through one Microsoft connection.", status: "Available in beta" },
        { icon: "pi-zoom", letter: "C", name: "Chrome", desc: "Open Beckett from supported work pages without starting over in a separate tab.", status: "Available in beta" },
      ].map((platform) => <div key={platform.name} className="plat-card"><div className={`plat-icon ${platform.icon}`}>{platform.letter}</div><div className="plat-name">{platform.name}</div><div className="plat-desc">{platform.desc}</div><div className="plat-live">{platform.status}</div></div>)}</div></div></div>

      <section id="skills"><div className="container"><div className="sec-label">Conversations you can practice</div><h2>Rehearse before the words<br /><em>have to count.</em></h2><p className="sec-sub">Choose a real workplace situation, practice with realistic pushback, and debrief what worked. These are examples—not customer testimonials.</p><div className="skills-grid">{practiceConversations.map((scenario) => <div key={scenario.situation} className="skill-card"><div className="sk-diff d-med">{scenario.label}</div><div className="sk-situation">&ldquo;{scenario.situation}&rdquo;</div><div className="sk-action">Practice this conversation →</div></div>)}</div></div></section>

      <div className="beta-wrap" id="beta"><div className="container"><div className="sec-label">Public beta</div><h2>Try Beckett now.<br /><em>Help shape what comes next.</em></h2><p className="sec-sub">Create an account immediately. Beta includes 60 successful coaching actions per day, 500 per month, full Practice, and every currently available skill course.</p><a href="/auth/signup" className="btn-primary">Create your free beta account</a><p className="beta-note">No approval wait · No credit card · Course activities do not use coaching credits</p></div></div>

      <footer className="hn-footer"><div className="f-logo f-logo-img"><Image src="/brand/beckett-horizontal-logo.png" alt="Beckett" width={118} height={30} /></div><div className="f-copy">© 2026 Beckett. For brains that work differently.</div><nav aria-label="Footer navigation" className="f-links"><a href="/features">Features</a><a href="/slack">Slack</a><a href="/pricing">Pricing</a><a href="/beta">Beta</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="mailto:hello@meetbeckett.co">Contact</a></nav></footer>
    </main>
  );
}
