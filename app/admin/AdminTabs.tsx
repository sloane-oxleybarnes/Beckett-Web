"use client";

import { Children, type ReactNode, useEffect, useMemo, useState } from "react";

type AdminTab = {
  id: string;
  label: string;
  description: string;
  count?: number;
};

export default function AdminTabs({
  tabs,
  children,
}: {
  tabs: AdminTab[];
  children: ReactNode;
}) {
  const panels = Children.toArray(children);
  const fallbackTabId = tabs[0]?.id || "";
  const [activeTabId, setActiveTabId] = useState(fallbackTabId);

  const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const currentTabId = tabIds.has(activeTabId) ? activeTabId : fallbackTabId;
  const activeTab = tabs.find((tab) => tab.id === currentTabId) || tabs[0];

  useEffect(() => {
    function syncFromHash() {
      const hash = window.location.hash.replace(/^#/, "");
      if (tabIds.has(hash)) setActiveTabId(hash);
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [tabIds]);

  function selectTab(id: string) {
    setActiveTabId(id);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
  }

  return (
    <div className="min-h-screen bg-bg px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-2 border-b border-border pb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-light">Beckett admin</p>
          <h1 className="text-2xl font-semibold text-ink">Admin panel</h1>
          {activeTab?.description && (
            <p className="max-w-3xl text-sm text-ink-mid">{activeTab.description}</p>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Admin sections"
          className="mb-6 flex gap-2 overflow-x-auto border-b border-border"
        >
          {tabs.map((tab) => {
            const selected = tab.id === currentTabId;
            return (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`admin-panel-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  selected
                    ? "border-primary text-primary"
                    : "border-transparent text-ink-mid hover:border-primary/40 hover:text-ink"
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span
                    className={`rounded-pill px-2 py-0.5 text-xs ${
                      selected ? "bg-primary-light text-primary" : "bg-white text-ink-light"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div>
          {tabs.map((tab, index) => {
            const selected = tab.id === currentTabId;
            return (
              <section
                key={tab.id}
                id={`admin-panel-${tab.id}`}
                role="tabpanel"
                aria-labelledby={`admin-tab-${tab.id}`}
                hidden={!selected}
                className="[&>*:first-child]:mt-0"
              >
                {panels[index]}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
