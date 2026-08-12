"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CONNECTED_APPS, type ConnectedAppDefinition, type ConnectedAppId } from "@/lib/connected-apps";
import type { SlackConnectionSummary, SlackDiagnosticConnection } from "@/lib/slack-diagnostics";

const APPS_PAGE_APPS = CONNECTED_APPS.filter((app) => !["chrome", "gmail", "google_calendar"].includes(app.id));
const GMAIL_APP = CONNECTED_APPS.find((app) => app.id === "gmail")!;
const GOOGLE_CALENDAR_APP = CONNECTED_APPS.find((app) => app.id === "google_calendar")!;

type AppsState = {
  selectedAppIds: ConnectedAppId[];
  connected: Record<ConnectedAppId, boolean>;
  details: Partial<Record<ConnectedAppId, string>>;
  slack: {
    connections: SlackDiagnosticConnection[];
    summary: SlackConnectionSummary;
  };
};

function AppMark({ app }: { app: ConnectedAppDefinition }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white" aria-hidden="true">
      <Image src={app.iconSrc} alt="" width={56} height={56} className="h-14 w-14 object-contain" />
    </div>
  );
}

function AppCard({ app, selected, connected, detail, onToggle, onConnect, onDisconnect, onManage, busy }: {
  app: ConnectedAppDefinition;
  selected: boolean;
  connected: boolean;
  detail?: string;
  onToggle: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onManage?: () => void;
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
        {(connected || (app.id === "slack" && detail)) && (
          <p className={`mb-2 truncate text-xs font-medium ${connected ? "text-green-700" : "text-amber-700"}`}>
            {app.id === "slack" ? detail : `Connected${detail ? ` · ${detail}` : ""}`}
          </p>
        )}
        <button
          type="button"
          onClick={onManage || (connected ? onDisconnect : onConnect)}
          disabled={busy}
          className={`w-full rounded-pill px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${onManage ? "border border-primary/30 text-primary hover:bg-primary-light" : connected ? "border border-red-200 text-red-700 hover:bg-red-50" : "bg-primary text-white hover:bg-primary-dark"}`}
        >
          {busy ? "Working…" : onManage ? "Manage workspaces" : connected ? "Disconnect" : "Connect"}
        </button>
      </div>
    </article>
  );
}

function GoogleWorkspaceCard({ selected, state, busy, onToggle, onConnect, onDisconnect }: {
  selected: boolean;
  state: AppsState;
  busy: boolean;
  onToggle: () => void;
  onConnect: (app: ConnectedAppDefinition) => void;
  onDisconnect: (app: ConnectedAppDefinition) => void;
}) {
  const capabilities = [GMAIL_APP, GOOGLE_CALENDAR_APP];
  const connectedCount = capabilities.filter((app) => state.connected[app.id]).length;
  return (
    <article className="relative flex min-h-72 flex-col rounded-card border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <button type="button" onClick={onToggle} disabled={busy} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-xl font-medium leading-none text-ink hover:border-primary hover:text-primary disabled:opacity-50" aria-label={selected ? "Remove Google Workspace from Your Apps" : "Add Google Workspace to Your Apps"} title={selected ? "Remove from Your Apps" : "Add to Your Apps"}>{selected ? "−" : "+"}</button>
      <div className="flex items-center gap-2" aria-hidden="true"><AppMark app={GMAIL_APP} /><Image src={GOOGLE_CALENDAR_APP.iconSrc} alt="" width={36} height={36} className="h-9 w-9 object-contain" /></div>
      <h3 className="mt-4 pr-8 text-lg font-semibold text-ink">Google Workspace</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-mid">Connect Gmail coaching and read-only Calendar preparation independently.</p>
      <p className={`mt-3 text-xs font-medium ${connectedCount ? "text-green-700" : "text-ink-light"}`}>{connectedCount ? `${connectedCount} of 2 capabilities connected` : "Not connected"}</p>
      <div className="mt-3 space-y-2">{capabilities.map((app) => { const connected = state.connected[app.id]; return <div key={app.id} className="flex items-center justify-between gap-3 rounded-sm border border-border bg-bg/50 px-3 py-2"><div className="min-w-0"><p className="text-sm font-medium text-ink">{app.id === "gmail" ? "Gmail" : "Calendar"}</p><p className={`truncate text-xs ${connected ? "text-green-700" : "text-ink-light"}`}>{connected ? `Connected${state.details[app.id] ? ` · ${state.details[app.id]}` : ""}` : "Optional"}</p></div><button type="button" onClick={() => connected ? onDisconnect(app) : onConnect(app)} disabled={busy} className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-medium ${connected ? "border border-red-200 text-red-700 hover:bg-red-50" : "bg-primary text-white hover:bg-primary-dark"}`}>{connected ? "Disconnect" : "Connect"}</button></div>; })}</div>
    </article>
  );
}

export default function AppsPanel() {
  const [state, setState] = useState<AppsState | null>(null);
  const [activeGuide, setActiveGuide] = useState<ConnectedAppDefinition | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedAppDefinition | null>(null);
  const [slackManagerOpen, setSlackManagerOpen] = useState(false);
  const [busySlackConnection, setBusySlackConnection] = useState<string | null>(null);
  const [busyAppId, setBusyAppId] = useState<ConnectedAppId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestedApp, setRequestedApp] = useState("");
  const [requestUseCase, setRequestUseCase] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [requestError, setRequestError] = useState("");

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
    const hasConnectionResult = ["calendar", "microsoft", "microsoft_error", "slack"].some((key) => params.has(key));
    if (!hasConnectionResult) return;
    void load();
    window.history.replaceState({}, "", "/dashboard/apps");
  }, [load]);

  const selected = useMemo(() => new Set(state?.selectedAppIds || []), [state?.selectedAppIds]);
  const googleSelected = selected.has("gmail") || selected.has("google_calendar");
  const yourApps = APPS_PAGE_APPS.filter((app) => selected.has(app.id));
  const availableApps = APPS_PAGE_APPS.filter((app) => !selected.has(app.id));

  async function toggleGoogleWorkspace() {
    if (!state) return;
    setBusyAppId("gmail");
    setError(null);
    try {
      if (googleSelected) {
        const responses = await Promise.all(["gmail", "google_calendar"].map((appId) => fetch(`/api/apps?appId=${appId}`, { method: "DELETE" })));
        if (responses.some((response) => !response.ok)) throw new Error("Could not remove Google Workspace from Your Apps.");
        setState((current) => current ? { ...current, selectedAppIds: current.selectedAppIds.filter((id) => id !== "gmail" && id !== "google_calendar") } : current);
      } else {
        const response = await fetch("/api/apps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appIds: ["gmail", "google_calendar"], source: "apps_page" }) });
        if (!response.ok) throw new Error("Could not add Google Workspace to Your Apps.");
        setState((current) => current ? { ...current, selectedAppIds: Array.from(new Set<ConnectedAppId>([...current.selectedAppIds, "gmail", "google_calendar"])) } : current);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update Your Apps.");
    } finally {
      setBusyAppId(null);
    }
  }

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
      const provider = app.id === "gmail" ? "google_workspace_addon"
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

  async function removeSlackConnection(connection: SlackDiagnosticConnection) {
    if (!connection.teamId || !connection.userId) return;
    const action = connection.kind === "legacy" ? "remove this old Slack connection" : "unlink your Beckett account from this Slack workspace";
    if (!window.confirm(`Are you sure you want to ${action}? This will not uninstall Beckett for anyone else in the workspace.`)) return;

    const key = `${connection.kind}:${connection.teamId}:${connection.userId}`;
    setBusySlackConnection(key);
    setError(null);
    try {
      const response = await fetch("/api/slack/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: connection.kind, teamId: connection.teamId, userId: connection.userId }),
      });
      const result = await response.json().catch(() => null) as ({
        error?: string;
        connections?: SlackDiagnosticConnection[];
        summary?: SlackConnectionSummary;
      } | null);
      if (!response.ok || !result?.connections || !result.summary) {
        throw new Error(result?.error || "Could not update this Slack workspace.");
      }
      setState((current) => current ? {
        ...current,
        connected: { ...current.connected, slack: result.summary!.connected },
        details: { ...current.details, slack: result.summary!.label },
        slack: { connections: result.connections!, summary: result.summary! },
      } : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update this Slack workspace.");
    } finally {
      setBusySlackConnection(null);
    }
  }

  async function submitAppRequest() {
    if (!requestedApp.trim() || requestStatus === "saving") return;
    setRequestStatus("saving");
    setRequestError("");
    try {
      const response = await fetch("/api/app-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName: requestedApp, useCase: requestUseCase }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Could not save your request.");
      setRequestStatus("saved");
      setRequestedApp("");
      setRequestUseCase("");
    } catch (requestErrorValue) {
      setRequestStatus("error");
      setRequestError(requestErrorValue instanceof Error ? requestErrorValue.message : "Could not save your request.");
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
        {yourApps.length || googleSelected ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{googleSelected && state && <GoogleWorkspaceCard selected state={state} busy={busyAppId === "gmail" || busyAppId === "google_calendar"} onToggle={() => void toggleGoogleWorkspace()} onConnect={setActiveGuide} onDisconnect={setDisconnectTarget} />}{yourApps.map((app) => <AppCard key={app.id} app={app} selected connected={Boolean(state?.connected[app.id])} detail={state?.details[app.id]} busy={busyAppId === app.id} onToggle={() => void toggleApp(app)} onConnect={() => setActiveGuide(app)} onDisconnect={() => setDisconnectTarget(app)} onManage={app.id === "slack" && state?.slack.connections.length ? () => setSlackManagerOpen(true) : undefined} />)}</div> : <div className="rounded-card border border-dashed border-border bg-white p-8 text-center text-sm text-ink-mid">No apps selected yet. Add one from Available Apps below.</div>}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Available Apps</h2>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{!googleSelected && state && <GoogleWorkspaceCard selected={false} state={state} busy={busyAppId === "gmail" || busyAppId === "google_calendar"} onToggle={() => void toggleGoogleWorkspace()} onConnect={setActiveGuide} onDisconnect={setDisconnectTarget} />}{availableApps.map((app) => <AppCard key={app.id} app={app} selected={false} connected={Boolean(state?.connected[app.id])} detail={state?.details[app.id]} busy={busyAppId === app.id} onToggle={() => void toggleApp(app)} onConnect={() => setActiveGuide(app)} onDisconnect={() => setDisconnectTarget(app)} onManage={app.id === "slack" && state?.slack.connections.length ? () => setSlackManagerOpen(true) : undefined} />)}<article className="flex min-h-72 flex-col rounded-card border border-dashed border-primary/40 bg-primary-light/20 p-5"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl text-primary" aria-hidden="true">+</div><h3 className="mt-4 text-lg font-semibold text-ink">Request another app</h3><p className="mt-2 flex-1 text-sm leading-relaxed text-ink-mid">Tell us which workplace app or browser you want Beckett to support next and how you would use it.</p><button type="button" onClick={() => { setRequestOpen(true); setRequestStatus("idle"); }} className="mt-4 w-full rounded-pill border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light">Request an integration</button></article></div>
      </section>

      <div className="mt-8 space-y-2 text-xs text-ink-light">
        <p>Need installation help? Visit the <Link href="/support" className="font-medium text-primary hover:underline">Beckett support guide</Link>.</p>
        <p>Gmail™ and Google Calendar™ are trademarks of Google LLC.</p>
      </div>

      {activeGuide && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="connect-app-title" onMouseDown={(event) => { if (event.currentTarget === event.target) setActiveGuide(null); }}><div className="w-full max-w-lg rounded-card bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><AppMark app={activeGuide} /><div><p className="text-xs font-medium uppercase tracking-wide text-primary">Connect app</p><h2 id="connect-app-title" className="text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>{activeGuide.name}</h2></div></div><button type="button" onClick={() => setActiveGuide(null)} className="text-2xl text-ink-light hover:text-ink" aria-label="Close">×</button></div><ol className="mt-6 space-y-4">{activeGuide.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-mid"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary">{index + 1}</span><span>{step}</span></li>)}</ol>{activeGuide.sharedProvider && <p className="mt-5 rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">Outlook and Microsoft Calendar are separate in Your Apps, but they share one Microsoft 365 authorization.</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setActiveGuide(null)} className="rounded-pill border border-border px-5 py-2 text-sm text-ink">Not now</button><button type="button" onClick={() => void beginConnection(activeGuide)} disabled={busyAppId === activeGuide.id} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">{activeGuide.connectLabel}</button></div></div></div>}

      {requestOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="request-app-title" onMouseDown={(event) => { if (event.currentTarget === event.target) setRequestOpen(false); }}><div className="w-full max-w-lg rounded-card bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wide text-primary">Product request</p><h2 id="request-app-title" className="text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Where should Beckett work next?</h2></div><button type="button" onClick={() => setRequestOpen(false)} className="text-2xl text-ink-light hover:text-ink" aria-label="Close">×</button></div>{requestStatus === "saved" ? <div className="mt-6 rounded-card border border-primary/20 bg-primary-light/35 p-5"><p className="font-medium text-ink">Thanks—your request is saved.</p><p className="mt-1 text-sm text-ink-mid">We’ll use beta requests to help prioritize future integrations and browser extensions.</p><button type="button" onClick={() => setRequestOpen(false)} className="mt-4 rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark">Done</button></div> : <><label className="mt-6 block text-sm font-medium text-ink">App, website, or browser<input value={requestedApp} onChange={(event) => setRequestedApp(event.target.value)} maxLength={120} placeholder="For example: Firefox, Discord, or Jira" className="mt-2 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" /></label><label className="mt-4 block text-sm font-medium text-ink">How would you want to use Beckett there? <span className="font-normal text-ink-light">(optional)</span><textarea value={requestUseCase} onChange={(event) => setRequestUseCase(event.target.value)} maxLength={1000} rows={4} placeholder="What should Beckett help you do?" className="mt-2 block w-full rounded-sm border border-border px-3 py-2 text-sm font-normal" /></label>{requestError && <p role="alert" className="mt-3 text-sm text-red-700">{requestError}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setRequestOpen(false)} className="rounded-pill border border-border px-5 py-2 text-sm text-ink">Cancel</button><button type="button" onClick={() => void submitAppRequest()} disabled={!requestedApp.trim() || requestStatus === "saving"} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">{requestStatus === "saving" ? "Saving…" : "Send request"}</button></div></>}</div></div>}

      {slackManagerOpen && state && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="slack-workspaces-title" onMouseDown={(event) => { if (event.currentTarget === event.target) setSlackManagerOpen(false); }}><div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wide text-primary">Slack</p><h2 id="slack-workspaces-title" className="text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Manage workspaces</h2><p className="mt-1 text-sm text-ink-mid">{state.slack.summary.label}. Unlinking only disconnects your Beckett account; it never uninstalls the workspace app for other people.</p></div><button type="button" onClick={() => setSlackManagerOpen(false)} className="text-2xl text-ink-light hover:text-ink" aria-label="Close">×</button></div><div className="mt-6 space-y-3">{state.slack.connections.map((connection) => { const key = `${connection.kind}:${connection.teamId}:${connection.userId}`; const busy = busySlackConnection === key; const reconnectLabel = connection.kind === "legacy" ? "Upgrade/relink" : "Reconnect"; return <article key={key} className="rounded-card border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{connection.teamName || connection.teamId || "Slack workspace"}</h3><span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${connection.state === "active" ? "bg-green-50 text-green-700" : connection.state === "degraded" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{connection.state}</span></div><p className="mt-1 text-sm text-ink-mid">{connection.message}</p>{connection.teamName && connection.teamId && <p className="mt-1 text-xs text-ink-light">Workspace ID: {connection.teamId}</p>}</div><div className="flex flex-wrap gap-2">{connection.state !== "active" && <a href="/slack/install?mode=connect" className="rounded-pill bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-dark">{reconnectLabel}</a>}{connection.kind === "legacy" && <button type="button" onClick={() => void removeSlackConnection(connection)} disabled={busy || !connection.teamId || !connection.userId} className="rounded-pill border border-red-200 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">{busy ? "Removing…" : "Remove old connection"}</button>}{connection.kind === "modern" && connection.state !== "disconnected" && <button type="button" onClick={() => void removeSlackConnection(connection)} disabled={busy || !connection.teamId || !connection.userId} className="rounded-pill border border-red-200 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">{busy ? "Unlinking…" : "Unlink"}</button>}</div></div></article>; })}</div><div className="mt-6 flex flex-wrap justify-between gap-3"><a href="/slack/install?mode=connect" className="rounded-pill border border-primary/30 px-5 py-2 text-sm font-medium text-primary hover:bg-primary-light">Add another workspace</a><button type="button" onClick={() => setSlackManagerOpen(false)} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark">Done</button></div></div></div>}

      {disconnectTarget && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="disconnect-app-title"><div className="w-full max-w-md rounded-card bg-white p-6 shadow-xl"><h2 id="disconnect-app-title" className="text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Disconnect {disconnectTarget.name}?</h2><p className="mt-3 text-sm leading-relaxed text-ink-mid">Beckett will stop using this connection for future coaching. Existing Beckett coaching history and contacts will not be deleted. The app will stay in Your Apps so you can reconnect later.</p>{disconnectTarget.sharedProvider && <p className="mt-4 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This also disconnects {disconnectTarget.id === "outlook" ? "Microsoft Calendar" : "Outlook"} because both use the same Microsoft 365 authorization.</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDisconnectTarget(null)} disabled={busyAppId === disconnectTarget.id} className="rounded-pill border border-border px-5 py-2 text-sm text-ink">Cancel</button><button type="button" onClick={() => void confirmDisconnect()} disabled={busyAppId === disconnectTarget.id} className="rounded-pill bg-red-700 px-5 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60">{busyAppId === disconnectTarget.id ? "Disconnecting…" : "Disconnect"}</button></div></div></div>}
    </div>
  );
}
