"use client";

import { useEffect, useState } from "react";

function labelFromHostname(hostname: string) {
  const host = hostname.toLowerCase();

  if (host === "localhost" || host === "127.0.0.1") return "development";
  if (host.includes("staging")) return "staging";
  if (host.endsWith(".vercel.app") && host.includes("-git-")) return "Preview";
  return "";
}

export default function StagingBannerClient({
  initialLabel,
  hidden,
}: {
  initialLabel: string;
  hidden: boolean;
}) {
  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    if (hidden || label) return;
    setLabel(labelFromHostname(window.location.hostname));
  }, [hidden, label]);

  if (hidden || !label) return null;

  return (
    <div className="sticky top-0 z-[100] border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-900">
      Beckett {label} environment - test data only
    </div>
  );
}
