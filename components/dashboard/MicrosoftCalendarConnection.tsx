"use client";

import { useCallback, useEffect, useState } from "react";

type CalendarOption = { id: string; name: string; primary: boolean };
type MicrosoftConnection = {
  connected: boolean;
  reauthorize?: boolean;
  calendars: CalendarOption[];
  selectedCalendarIds: string[];
};

export default function MicrosoftCalendarConnection() {
  const [connection, setConnection] = useState<MicrosoftConnection | null>(null);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showCalendarChoices, setShowCalendarChoices] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/microsoft/calendars", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as MicrosoftConnection & { error?: string } | null;
      if (!response.ok || !data) throw new Error(data?.error || "Could not load Microsoft Calendar settings.");
      setConnection(data);
      setSelectedCalendarIds(data.selectedCalendarIds || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load Microsoft Calendar settings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("microsoft");
    const connectionError = params.get("microsoft_error");
    if (!status && !connectionError) return;
    if (status === "connected") {
      setError(null);
      setNotice("Microsoft 365 connected. Choose the calendars Beckett may use.");
      setShowCalendarChoices(true);
      void load();
    } else if (connectionError) {
      setError(connectionError === "configuration-required"
        ? "Microsoft 365 is not configured for this environment yet."
        : "Microsoft 365 connection could not be completed. Please try again.");
    }
    window.history.replaceState({}, "", "/dashboard/settings#connected-accounts");
  }, [load]);

  function connect() {
    window.location.assign("/api/microsoft/connect");
  }

  function toggleCalendar(id: string) {
    setError(null);
    setSelectedCalendarIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  }

  async function saveChoices() {
    if (!selectedCalendarIds.length) {
      setError("Choose at least one calendar.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/microsoft/calendars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCalendarIds }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not save Microsoft Calendar choices.");
      setNotice("Microsoft Calendar choices saved.");
      await load();
      setShowCalendarChoices(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save Microsoft Calendar choices.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Microsoft 365? Beckett will delete its stored Microsoft tokens and stop reading calendar events.")) return;
    setDisconnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/microsoft", { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not disconnect Microsoft 365.");
      setNotice("Microsoft 365 disconnected.");
      setShowCalendarChoices(false);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not disconnect Microsoft 365.");
    } finally {
      setDisconnecting(false);
    }
  }

  const needsReconnect = connection?.connected && connection.reauthorize;

  return <div className="border-t border-border pt-4">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-lg">▦</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">Microsoft 365 Calendar</p>
        <p className="text-xs text-ink-light">Read-only Outlook meeting context from only the calendars you choose.</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 pl-8">
      {connection?.connected && <span className={`rounded-pill px-3 py-1 text-xs font-medium ${needsReconnect ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>{needsReconnect ? "Needs reconnection" : "Connected"}</span>}
      {connection?.connected && !connection.reauthorize && <button type="button" onClick={() => setShowCalendarChoices((current) => !current)} className="rounded-pill border border-border px-4 py-1.5 text-xs text-ink hover:bg-bg">{showCalendarChoices ? "Done changing calendars" : "Change connected calendars"}</button>}
      <button type="button" onClick={connect} disabled={disconnecting} className="rounded-pill border border-border px-4 py-1.5 text-xs text-ink hover:bg-bg">{connection?.connected ? "Reconnect" : "Connect"}</button>
      {connection?.connected && <button type="button" onClick={() => void disconnect()} disabled={disconnecting} className="rounded-pill border border-red-200 px-4 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60">{disconnecting ? "Disconnecting…" : "Disconnect"}</button>}
    </div>
    {notice && <p className="mt-3 text-xs text-green-700" role="status">{notice}</p>}
    {error && <p className="mt-3 text-xs text-red-700" role="alert">{error}</p>}
    {connection?.connected && !connection.reauthorize && showCalendarChoices && connection.calendars.length > 0 && <div className="mt-4 rounded-sm border border-border bg-bg/50 p-4"><p className="text-sm font-medium text-ink">Microsoft calendars Beckett can use</p><p className="mt-1 text-xs text-ink-mid">Only selected calendars appear in your week view and meeting-prep suggestions.</p><div className="mt-3 space-y-2">{connection.calendars.map((calendar) => <label key={calendar.id} className="flex cursor-pointer items-center gap-3 rounded-sm border border-border bg-white px-3 py-2 text-sm text-ink"><input type="checkbox" checked={selectedCalendarIds.includes(calendar.id)} onChange={() => toggleCalendar(calendar.id)} className="h-4 w-4 accent-primary" /><span>{calendar.name}{calendar.primary ? " (primary)" : ""}</span></label>)}</div><button type="button" onClick={() => void saveChoices()} disabled={saving || !selectedCalendarIds.length} className="mt-4 rounded-pill bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60">{saving ? "Saving…" : "Save calendar choices"}</button></div>}
  </div>;
}
