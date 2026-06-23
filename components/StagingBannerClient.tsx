"use client";

import { useEffect, useRef, useState } from "react";

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
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    if (!hidden && !label) setLabel(labelFromHostname(window.location.hostname));
  }, [hidden, label]);

  useEffect(() => {
    const root = document.documentElement;

    if (hidden || !label) {
      root.classList.remove("beckett-env-banner-visible");
      root.style.removeProperty("--beckett-env-banner-height");
      return;
    }

    function updateHeight() {
      const height = bannerRef.current?.offsetHeight || 0;
      root.classList.add("beckett-env-banner-visible");
      root.style.setProperty("--beckett-env-banner-height", `${height}px`);
    }

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      root.classList.remove("beckett-env-banner-visible");
      root.style.removeProperty("--beckett-env-banner-height");
    };
  }, [hidden, label]);

  if (hidden || !label) return null;

  return (
    <div ref={bannerRef} className="sticky top-0 z-[200] border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-900">
      Beckett {label} environment - test data only
    </div>
  );
}
