"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "next/navigation";
import { hasMeaningfulMeetingContext, type MeetingPrepContact } from "@/lib/meeting-prep-recommendations";

const split = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
type PromptKey = "outcome" | "concern" | "role";

const roleOptions = [
  ["lead", "Lead the conversation"],
  ["contribute", "Share an update or perspective"],
  ["ask", "Ask for something or get clarity"],
  ["listen", "Listen, take notes, and decide next steps"],
] as const;

export default function MeetingPrepPanel() {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState(() => searchParams.get("title") || "");
  const [goals, setGoals] = useState("");
  const [attendees, setAttendees] = useState(() => searchParams.get("attendees") || "");
  const [reminders, setReminders] = useState("");
  const [checklist, setChecklist] = useState("Review the agenda\nChoose one clear outcome\nLeave room for questions");
  const [outcome, setOutcome] = useState("");
  const [concern, setConcern] = useState("");
  const [role, setRole] = useState("contribute");
  const [openPrompt, setOpenPrompt] = useState<PromptKey>("outcome");
  const [contacts, setContacts] = useState<MeetingPrepContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/contacts");
      const data = await response.json().catch(() => null) as { contacts?: MeetingPrepContact[] } | null;
      if (response.ok) setContacts(data?.contacts || []);
    })();
  }, []);

  const matchedContacts = useMemo(
    () => contacts.filter((contact) => attendees.toLowerCase().includes(contact.name.toLowerCase()) || Boolean(contact.email && attendees.toLowerCase().includes(contact.email.toLowerCase()))),
    [attendees, contacts]
  );
  const contactsWithContext = useMemo(() => matchedContacts.filter(hasMeaningfulMeetingContext), [matchedContacts]);

  const beforeSuggestions = useMemo(() => {
    const suggestions = ["Review the agenda and choose one sentence you want to leave with."];
    if (role === "ask") suggestions.unshift("Write the specific ask, plus the smallest useful next step if the answer is not clear today.");
    if (role === "lead") suggestions.unshift("Open with the outcome and the decision or discussion you need from the group.");
    if (concern.trim()) suggestions.push("Name one grounding or clarity move you can use if the conversation gets harder than expected.");
    if (contactsWithContext.length) suggestions.push(`Review the user-saved context you selected for ${contactsWithContext.map((contact) => contact.name).join(", ")}; treat it as a reminder, not a prediction.`);
    return suggestions.slice(0, 3);
  }, [concern, contactsWithContext, role]);

  const duringSuggestions = useMemo(() => {
    const suggestions = ["Pause before agreeing to a new deadline or request.", "Ask: “What would a good next step look like from your perspective?”"];
    if (role === "ask") suggestions.unshift("State your ask plainly, then leave space for an answer.");
    if (role === "listen") suggestions.unshift("Capture decisions, owners, and questions instead of trying to solve everything live.");
    if (concern.trim()) suggestions.push("If you need time: “I want to give that a thoughtful answer. Can I come back to you by [time]?”");
    return suggestions.slice(0, 3);
  }, [concern, role]);

  function addLine(setter: Dispatch<SetStateAction<string>>, line: string) {
    setter((current) => split(current).includes(line) ? current : `${current.trim()}${current.trim() ? "\n" : ""}${line}`);
  }

  function addSavedContext() {
    const context = contactsWithContext
      .map((contact) => `${contact.name}${contact.relationship_tags?.length ? ` — ${contact.relationship_tags.join(", ")}` : ""}${contact.notes ? `: ${contact.notes}` : ""}`)
      .join("\n");
    if (context) setAttendees((current) => current.includes(context) ? current : `${current}${current ? "\n\n" : ""}User-saved context:\n${context}`);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const created = await fetch("/api/meetings/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, source: "calendar" }),
      });
      const initial = await created.json() as { session?: { id: string }; error?: string };
      if (!created.ok || !initial.session) throw new Error(initial.error || "Could not start meeting preparation.");
      const preparation = [outcome && `Desired outcome: ${outcome}`, concern && `Concern or likely pressure point: ${concern}`, role && `Meeting role: ${roleOptions.find(([value]) => value === role)?.[1]}`].filter(Boolean).join("\n");
      const updated = await fetch(`/api/meetings/sessions/${initial.session.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_notes: preparation,
          final_summary: "",
          follow_up_draft: "",
          decisions: [],
          open_questions: [],
          pre_meeting_goals: split(`${goals}${goals && outcome ? "\n" : ""}${outcome}`),
          attendee_context: attendees,
          communication_reminders: split(reminders),
          prep_checklist: split(checklist),
        }),
      });
      if (!updated.ok) throw new Error("Could not save meeting preparation.");
      setMessage("Meeting preparation saved privately in Beckett.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save meeting preparation.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="max-w-4xl">
    <p className="text-xs font-medium uppercase tracking-wide text-primary">Meeting preparation</p>
    <h1 className="mt-2 text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Let&apos;s get you ready for this meeting.</h1>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mid">Beckett uses the meeting details and only the relationship context you choose to include. It will not send anything, change your calendar, or assume what another person thinks.</p>

    <form onSubmit={save} className="mt-7 space-y-6">
      <section className="rounded-card border border-border bg-white p-5 sm:p-6">
        <Field label="Meeting" value={title} onChange={setTitle} placeholder="Weekly project check-in" />
        <p className="mt-2 text-xs text-ink-light">Start with a quick read of the moment, then keep only what is useful.</p>

        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-medium text-ink">Beckett&apos;s questions</p>
          <div className="mt-3 space-y-2">
            <Prompt title="What would make this meeting feel successful?" open={openPrompt === "outcome"} onClick={() => setOpenPrompt("outcome")}>
              <textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="For example: leave with a clear decision, a realistic deadline, or a shared next step." rows={3} className="mt-3 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" />
            </Prompt>
            <Prompt title="Is there anything you are worried might come up?" open={openPrompt === "concern"} onClick={() => setOpenPrompt("concern")}>
              <textarea value={concern} onChange={(event) => setConcern(event.target.value)} placeholder="You can name uncertainty, a sensitive topic, a power dynamic, or leave this blank." rows={3} className="mt-3 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" />
            </Prompt>
            <Prompt title="What do you want your role to be today?" open={openPrompt === "role"} onClick={() => setOpenPrompt("role")}>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{roleOptions.map(([value, label]) => <button key={value} type="button" onClick={() => setRole(value)} aria-pressed={role === value} className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${role === value ? "border-primary bg-primary-light/50 text-ink" : "border-border text-ink-mid hover:bg-bg"}`}>{label}</button>)}</div>
            </Prompt>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <CoachCard title="What Beckett knows" eyebrow="User-controlled context">
          {contactsWithContext.length ? <><p className="text-sm leading-relaxed text-ink-mid">You have saved context for {contactsWithContext.map((contact) => contact.name).join(", ")}. Beckett will only use it in this prep after you choose to include it.</p><div className="mt-3 flex flex-wrap gap-2">{contactsWithContext.map((contact) => <span key={contact.email || contact.name} className="rounded-pill bg-primary-light px-3 py-1 text-xs text-ink">{contact.name}{contact.relationship_tags?.length ? ` · ${contact.relationship_tags.join(", ")}` : " · saved notes"}</span>)}</div><button type="button" onClick={addSavedContext} className="mt-3 text-sm font-medium text-primary hover:underline">Use this saved context in my prep →</button></> : <p className="text-sm leading-relaxed text-ink-mid">Attendees from your calendar are included here. Add a contact with a relationship note or tag if you want Beckett to make proactive prep suggestions for a future meeting.</p>}
          <Area label="Attendees and context you want to include" value={attendees} onChange={setAttendees} placeholder="Names, roles, and any context you want Beckett to consider." rows={4} compact />
        </CoachCard>
        <CoachCard title="Your plan for before" eyebrow="A few useful moves">
          <SuggestionList suggestions={beforeSuggestions} onAdd={(suggestion) => addLine(setChecklist, suggestion)} buttonLabel="Add to my prep" />
          <Area label="My preparation checklist" value={checklist} onChange={setChecklist} rows={4} compact />
        </CoachCard>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <CoachCard title="Support during the meeting" eyebrow="Keep it simple">
          <SuggestionList suggestions={duringSuggestions} onAdd={(suggestion) => addLine(setReminders, suggestion)} buttonLabel="Keep this in view" />
          <Area label="My reminders and phrases" value={reminders} onChange={setReminders} placeholder="For example: ask for written next steps; pause before agreeing to a new deadline." rows={4} compact />
        </CoachCard>
        <CoachCard title="A clear next move" eyebrow="Make the outcome actionable">
          <p className="text-sm leading-relaxed text-ink-mid">If you need a little more structure, add the one thing you want to accomplish. Beckett will save this with your private meeting prep, not send it to anyone.</p>
          <Area label="Additional goals (one per line)" value={goals} onChange={setGoals} placeholder="Clarify who owns the launch plan" rows={4} compact />
        </CoachCard>
      </section>

      <div className="rounded-card border border-primary/20 bg-primary-light/35 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div><p className="font-medium text-ink">Ready when you are.</p><p className="mt-1 text-sm text-ink-mid">Save this optional preparation to revisit before or after the meeting.</p></div>
        <button disabled={saving || !title.trim()} className="mt-4 rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-60 sm:mt-0">{saving ? "Saving…" : "Save meeting preparation"}</button>
      </div>
      {message && <p className="text-sm text-ink-mid" role="status">{message}</p>}
    </form>
  </div>;
}

function Prompt({ title, open, onClick, children }: { title: string; open: boolean; onClick: () => void; children: React.ReactNode }) {
  return <div className="rounded-sm border border-border bg-bg/40"><button type="button" onClick={onClick} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium text-ink"><span>{title}</span><span className="text-lg text-primary" aria-hidden="true">{open ? "−" : "+"}</span></button>{open && <div className="border-t border-border px-4 pb-4">{children}</div>}</div>;
}

function CoachCard({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="rounded-card border border-border bg-white p-5"><p className="text-xs font-medium uppercase tracking-wide text-primary">{eyebrow}</p><h2 className="mt-1 text-xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{title}</h2><div className="mt-3">{children}</div></section>;
}

function SuggestionList({ suggestions, onAdd, buttonLabel }: { suggestions: string[]; onAdd: (suggestion: string) => void; buttonLabel: string }) {
  return <ul className="space-y-3">{suggestions.map((suggestion) => <li key={suggestion} className="flex gap-3 text-sm leading-relaxed text-ink-mid"><span className="mt-1 text-primary" aria-hidden="true">•</span><div className="flex-1"><p>{suggestion}</p><button type="button" onClick={() => onAdd(suggestion)} className="mt-1 text-xs font-medium text-primary hover:underline">{buttonLabel}</button></div></li>)}</ul>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block text-sm font-medium text-ink">{label}<input required value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" /></label>;
}

function Area({ label, value, onChange, placeholder, rows = 4, compact = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number; compact?: boolean }) {
  return <label className={`${compact ? "mt-4" : "mt-4"} block text-sm font-medium text-ink`}>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="mt-1 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" /></label>;
}

