"use client";

import { RouteState } from "@/components/ui/RouteState";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div>
      <RouteState
        title="That page did not load"
        message="Your information is safe. Try the request again, or return to the dashboard."
        action={{ href: "/dashboard", label: "Return to dashboard" }}
      />
      <div className="-mt-24 text-center">
        <button className="text-sm text-primary underline" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
