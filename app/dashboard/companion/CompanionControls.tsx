"use client";

import { useEffect, useState } from "react";

type Preferences = {
  desktop_companion_enabled: boolean;
  meeting_support_enabled: boolean;
  meeting_prompt_style: "off" | "quiet" | "direct";
  meeting_retention_preference: "do_not_save" | "notes_only" | "summary_only";
  meeting_consent_reminder_enabled: boolean;
};

const defaults: Preferences = {
  desktop_companion_enabled: false,
  meeting_support_enabled: false,
  meeting_prompt_style: "quiet",
  meeting_retention_preference: "summary_only",
  meeting_consent_reminder_enabled: true,
};

export default function CompanionControls({ readOnly = false }: { readOnly?: boolean }) {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/companion/preferences");
        const data = await response.json() as { preferences?: Preferences };
        if (response.ok && data.preferences) setPreferences(data.preferences);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/companion/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const data = await response.json() as { preferences?: Preferences; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save Companion settings.");
      if (data.preferences) setPreferences(data.preferences);
      setMessage("Companion settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save Companion settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-mid">Loading Companion settings…</p>;

  if (readOnly) {
    return (
      <div>
        <p className="text-sm font-medium text-ink">Desktop Companion</p>
        <p className="mt-1 text-sm text-ink-mid">
          {preferences.desktop_companion_enabled ? "Preview enabled" : "Preview off"}
          {preferences.meeting_support_enabled ? " · Meeting support enabled" : " · Meeting support off"}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-6">
      <h3 className="text-sm font-medium text-ink">Desktop Companion</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-mid">
        The optional Companion is user-invoked. It never sends messages, silently records your screen, or retains raw meeting audio or transcripts.
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-bg/50 p-3">
        <input type="checkbox" checked={preferences.desktop_companion_enabled} onChange={(event) => setPreferences({ ...preferences, desktop_companion_enabled: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />
        <span><span className="block text-sm font-medium text-ink">Join the Desktop Companion preview</span><span className="mt-0.5 block text-xs text-ink-mid">Enable the user-invoked desktop overlay and global shortcut.</span></span>
      </label>
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-bg/50 p-3">
        <input type="checkbox" checked={preferences.meeting_support_enabled} onChange={(event) => setPreferences({ ...preferences, meeting_support_enabled: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />
        <span><span className="block text-sm font-medium text-ink">Allow meeting support</span><span className="mt-0.5 block text-xs text-ink-mid">You still start every meeting session yourself.</span></span>
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink">In-meeting prompt style<select value={preferences.meeting_prompt_style} onChange={(event) => setPreferences({ ...preferences, meeting_prompt_style: event.target.value as Preferences["meeting_prompt_style"] })} className="mt-1 block w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal"><option value="off">Only when I ask</option><option value="quiet">Quiet suggestions</option><option value="direct">More direct prompts</option></select></label>
        <label className="text-sm font-medium text-ink">What to retain<select value={preferences.meeting_retention_preference} onChange={(event) => setPreferences({ ...preferences, meeting_retention_preference: event.target.value as Preferences["meeting_retention_preference"] })} className="mt-1 block w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-normal"><option value="do_not_save">Do not save anything</option><option value="notes_only">Only notes I choose</option><option value="summary_only">Final summary and notes</option></select></label>
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3"><input type="checkbox" checked={preferences.meeting_consent_reminder_enabled} onChange={(event) => setPreferences({ ...preferences, meeting_consent_reminder_enabled: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" /><span className="text-sm text-ink">Show a consent reminder before meeting support</span></label>
      <button type="button" onClick={() => void save()} disabled={saving} className="mt-4 rounded-pill border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-primary-light disabled:opacity-60">{saving ? "Saving…" : "Save Companion settings"}</button>
      {message && <p className="mt-2 text-xs text-ink-mid" role="status">{message}</p>}
    </div>
  );
}
