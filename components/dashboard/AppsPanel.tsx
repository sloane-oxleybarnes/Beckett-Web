"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CONNECTED_APPS, type ConnectedAppDefinition, type ConnectedAppId } from "@/lib/connected-apps";

type AppsState = {
  selectedAppIds: ConnectedAppId[];
  connected: Record<ConnectedAppId, boolean>;
  details: Partial<Record<ConnectedAppId, string>>;
};

function AppMark({ app }: { app: ConnectedAppDefinition }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white" aria-hidden="true">
      <Image src={app.iconSrc} alt="" width={56} height={56} className="h-14 w-14 object-contain" />
    </div>
  );
}

function AppCard({ app, selected, connected, detail, onToggle, onConnect, onDisconnect, busy }: {
  app: ConnectedAppDefinition;
  selected: boolean;
  connected: boolean;
  detail?: string;
  onToggle: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  busy: boolean;
}) {
  return (
    <article className="relative flex min-h-72 flex-col rounded-card border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-xl font-medium leading-none text-ink hover:border-primary hover:text-primary disabled:opacity-50"
        aria-label={selected ? `Remove ${app.name} from Your Apps` : `Add ${app.name} to Your Apps`}
        title={selected ? "Remove from Your Apps" : "Add to Your Apps"}
      >
        {selected ? "−" : "+"}
      </button>
      <AppMark app={app} />
      <h3 className="mt-4 pr-8 text-lg font-semibold text-ink">{app.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-mid">{app.description}</p>
      <div className="mt-4">
        {connected && (
          <p className="mb-2 truncate text-xs font-medium text-green-700">
            Connected{detail ? ` · ${detail}` : ""}
          </p>
        )}
        <button
          type="button"
          onClick={connected ? onDisconnect : onConnect}
          disabled={busy}
          className={`w-full rounded-pill px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${connected ? "border border-red-200 text-red-700 hover:bg-red-50" : "bg-primary text-white hover:bg-primary-dark"}`}
        >
          {busy ? "Working…" : connected ? "Disconnect" : "Connect"}
        </button>
      </div>
    </article>
  );
}

export default function AppsPanel() {
  const [state, setState] = useState<AppsState | null>(null);
  const [activeGuide, setActiveGuide] = useState<ConnectedAppDefinition | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedAppDefinition | null>(null);
  const [busyAppId, setBusyAppId] = useState<ConnectedAppId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/apps", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as AppsState & { error?: string } | null;
    if (!response.ok || !data) throw new Error(data?.error || "Could not load your apps.");
    setState(data);
  }, []);

  useEffect(() => {
    void load().catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Could not load your apps."));
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasConnectionResult = ["gmail", "calendar", "microsoft", "microsoft_error", "slack"].some((key) => params.has(key));
    if (!hasConnectionResult) return;
    void load();
    window.history.replaceState({}, "", "/dashboard/apps");
  }, [load]);

  const selected = useMemo(() => new Set(state?.selectedAppIds || []), [state?.selectedAppIds]);
  const yourApps = CONNECTED_APPS.filter((app) => selected.has(app.id));
  const availableApps = CONNECTED_APPS.filter((app) => !selected.has(app.id));

  async function toggleApp(app: ConnectedAppDefinition) {
    if (!state) return;
    setBusyAppId(app.id);
    setError(null);
    try {
      const isSelected = selected.has(app.id);
      const response = await fetch(isSelected ? `/api/apps?appId=${encodeURIComponent(app.id)}` : "/api/apps", {
        method: isSelected ? "DELETE" : "POST",
        headers: isSelected ? undefined : { "Content-Type": "application/json" },
        body: isSelected ? undefined : JSON.stringify({ appIds: [app.id], source: "apps_page" }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Could not update Your Apps.");
      setState((current) => current ? {
        ...current,
        selectedAppIds: isSelected
          ? current.selectedAppIds.filter((id) => id !== app.id)
          : [...current.selectedAppIds, app.id],
      } : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update Your Apps.");
    } finally {
      setBusyAppId(null);
    }
  }

  async function beginConnection(app: ConnectedAppDefinition) {
    setBusyAppId(app.id);
    setError(null);
    try {
      const ids = app.sharedProvider ? (["outlook", "microsoft_calendar"] as ConnectedAppId[]) : [app.id];
      const response = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appIds: ids, source: "connection" }),
      });
      if (!response.ok) throw new Error("Could not save this app before connecting.");
      if (app.connectHref.startsWith("http")) window.open(app.connectHref, "_blank", "noopener,noreferrer");
      else window.location.assign(app.connectHref);
    } catch (requestError) {
      setBusyAppId(null);
      setError(requestError instanceof Error ? requestError.message : "Could not start the connection.");
    }
  }

  async function confirmDisconnect() {
    const app = disconnectTarget;
    if (!app) return;
    setBusyAppId(app.id);
    setError(null);
    try {
      const provider = app.id === "gmail" ? "google"
        : app.id === "google_calendar" ? "google_calendar"
        : app.id === "slack" ? "slack"
        : app.id === "chrome" ? "chrome"
        : "microsoft";
      const response = await fetch(`/api/integrations/${provider}`, { method: "DELETE" });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || `Could not disconnect ${app.name}.`);
      setDisconnectTarget(null);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Could not disconnect ${app.name}.`);
    } finally {
      setBusyAppId(null);
    }
  }

  if (!state && !error) return <div className="flex h-64 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary">Connected apps</p>
        <h1 className="text-3xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Bring Beckett into your workday</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mid">Choose the tools you use, then connect each one when you are ready. Adding or removing a card only changes Your Apps; Disconnect removes Beckett&apos;s access.</p>
      </div>

      {error && <div className="mb-5 rounded-sm border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      <section>
        <h2 className="mb-4 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Your Apps</h2>
        {yourApps.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{yourApps.map((app) => <AppCard key={app.id} app={app} selected connected={Boolean(state?.connected[app.id])} detail={state?.details[app.id]} busy={busyAppId === app.id} onToggle={() => void toggleApp(app)} onConnect={() => setActiveGuide(app)} onDisconnect={() => setDisconnectTarget(app)} />)}</div> : <div className="rounded-card border border-dashed border-border bg-white p-8 text-center text-sm text-ink-mid">No apps selected yet. Add one from Available Apps below.</div>}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Available Apps</h2>
        {availableApps.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{availableApps.map((app) => <AppCard key={app.id} app={app} selected={false} connected={Boolean(state?.connected[app.id])} detail={state?.details[app.id]} busy={busyAppId === app.id} onToggle={() => void toggleApp(app)} onConnect={() => setActiveGuide(app)} onDisconnect={() => setDisconnectTarget(app)} />)}</div> : <div className="rounded-card border border-primary/20 bg-primary-light/40 p-6 text-sm text-ink-mid">Every available integration is in Your Apps.</div>}
      </section>

      <p className="mt-8 text-xs text-ink-light">Need installation help? Visit the <Link href="/support" className="font-medium text-primary hover:underline">Beckett support guide</Link>.</p>

      {activeGuide && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="connect-app-title" onMouseDown={(event) => { if (event.currentTarget === event.target) setActiveGuide(null); }}><div className="w-full max-w-lg rounded-card bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><AppMark app={activeGuide} /><div><p className="text-xs font-medium uppercase tracking-wide text-primary">Connect app</p><h2 id="connect-app-title" className="text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{activeGuide.name}</h2></div></div><button type="button" onClick={() => setActiveGuide(null)} className="text-2xl text-ink-light hover:text-ink" aria-label="Close">×</button></div><ol className="mt-6 space-y-4">{activeGuide.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-mid"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">{index + 1}</span><span>{step}</span></li>)}</ol>{activeGuide.sharedProvider && <p className="mt-5 rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">Outlook and Microsoft Calendar are separate in Your Apps, but they share one Microsoft 365 authorization.</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setActiveGuide(null)} className="rounded-pill border border-border px-5 py-2 text-sm text-ink">Not now</button><button type="button" onClick={() => void beginConnection(activeGuide)} disabled={busyAppId === activeGuide.id} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">{activeGuide.connectLabel}</button></div></div></div>}

      {disconnectTarget && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="disconnect-app-title"><div className="w-full max-w-md rounded-card bg-white p-6 shadow-xl"><h2 id="disconnect-app-title" className="text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Disconnect {disconnectTarget.name}?</h2><p className="mt-3 text-sm leading-relaxed text-ink-mid">Beckett will stop using this connection for future coaching. Existing Beckett coaching history and contacts will not be deleted. The app will stay in Your Apps so you can reconnect later.</p>{disconnectTarget.sharedProvider && <p className="mt-4 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This also disconnects {disconnectTarget.id === "outlook" ? "Microsoft Calendar" : "Outlook"} because both use the same Microsoft 365 authorization.</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDisconnectTarget(null)} disabled={busyAppId === disconnectTarget.id} className="rounded-pill border border-border px-5 py-2 text-sm text-ink">Cancel</button><button type="button" onClick={() => void confirmDisconnect()} disabled={busyAppId === disconnectTarget.id} className="rounded-pill bg-red-700 px-5 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60">{busyAppId === disconnectTarget.id ? "Disconnecting…" : "Disconnect"}</button></div></div></div>}
    </div>
  );
}
