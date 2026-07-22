"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Reminder = { id: string; title: string; reminder_time: string; days_of_week: number[]; active: boolean };

export default function WorkdayReminderNudge() {
  const [due, setDue] = useState<Reminder | null>(null);
  useEffect(() => { let timer: ReturnType<typeof setInterval>; async function check() { const response = await fetch("/api/workday/reminders"); const data = await response.json().catch(() => null) as { reminders?: Reminder[] } | null; if (!response.ok) return; const now = new Date(); const currentTime = now.toTimeString().slice(0, 5); const reminder = (data?.reminders || []).find((item) => item.active && item.days_of_week.includes(now.getDay()) && item.reminder_time.slice(0, 5) === currentTime); if (!reminder) return; const key = `beckett:reminder:${reminder.id}:${now.toDateString()}:${currentTime}`; if (localStorage.getItem(key)) return; localStorage.setItem(key, "shown"); setDue(reminder); if ("Notification" in window && Notification.permission === "granted") new Notification("Beckett reminder", { body: reminder.title }); } void check(); timer = setInterval(() => void check(), 60_000); return () => clearInterval(timer); }, []);
  if (!due) return null;
  return <section className="mb-6 rounded-card border border-primary/30 bg-primary-light/40 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-ink">{due.title}</p><p className="mt-1 text-sm text-ink-mid">Take a private moment to check in. You can dismiss this without recording anything.</p></div><button type="button" onClick={() => setDue(null)} className="text-xs text-ink-mid hover:text-ink">Dismiss</button></div><Link href="#workday-checkin" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Open check-in ↓</Link></section>;
}
