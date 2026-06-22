"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Profile } from "@/lib/supabase";
import DashboardSidebar from "@/components/dashboard/Sidebar";
import BetaFeedbackWidget from "@/components/dashboard/BetaFeedbackWidget";

const sidebarStorageKey = "beckett-dashboard-sidebar-collapsed";

export default function DashboardShell({
  profile,
  userEmail,
  children,
}: {
  profile: Profile | null;
  userEmail: string;
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem(sidebarStorageKey) === "true");
  }, []);

  function setDesktopSidebarCollapsed(collapsed: boolean) {
    setSidebarCollapsed(collapsed);
    localStorage.setItem(sidebarStorageKey, String(collapsed));
  }

  return (
    <div className="min-h-screen bg-bg flex">
      <DashboardSidebar
        profile={profile}
        userEmail={userEmail}
        desktopCollapsed={sidebarCollapsed}
        onDesktopCollapseChange={setDesktopSidebarCollapsed}
      />
      <main
        className={`flex-1 px-4 py-6 pt-16 transition-[margin] duration-200 md:px-8 md:py-8 md:pt-8 ${
          sidebarCollapsed ? "md:ml-0" : "md:ml-64"
        }`}
      >
        {children}
      </main>
      <BetaFeedbackWidget />
    </div>
  );
}
