"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SavedRecommendation = {
  recommendation_key: string;
  title: string;
  href: string;
  reason: string;
};

export default function SavedLearningRecommendations() {
  const [recommendations, setRecommendations] = useState<SavedRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/learning/saved-recommendations", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { recommendations?: SavedRecommendation[] } | null) => setRecommendations(data?.recommendations || []))
      .finally(() => setLoading(false));
  }, []);

  async function removeSavedRecommendation(key: string) {
    setRemovingKey(key);
    try {
      const response = await fetch(`/api/learning/saved-recommendations?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setRecommendations((current) => current.filter((recommendation) => recommendation.recommendation_key !== key));
    } finally {
      setRemovingKey(null);
    }
  }

  if (loading || !recommendations.length) return null;

  return (
    <section className="mb-10 rounded-card border border-primary/20 bg-primary-light/35 p-5 sm:p-6" aria-label="Saved learning suggestions">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Saved for later</p>
      <h2 className="mt-1 text-2xl text-ink" style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}>Come back when it fits.</h2>
      <div className="mt-4 grid gap-3">
        {recommendations.map((recommendation) => (
          <div key={recommendation.recommendation_key} className="flex flex-col gap-3 rounded-sm border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{recommendation.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-mid">{recommendation.reason}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link href={recommendation.href} className="text-xs font-medium text-primary hover:underline">Open</Link>
              <button type="button" disabled={removingKey === recommendation.recommendation_key} onClick={() => void removeSavedRecommendation(recommendation.recommendation_key)} className="text-xs font-medium text-ink-light hover:underline disabled:opacity-60">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
