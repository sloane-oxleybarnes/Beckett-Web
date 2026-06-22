"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const MOODS = ["Low", "Strained", "Okay", "Focused", "Energized"];

const legacyMoodLabels: Record<string, string> = {
  "😔": "Low",
  "😐": "Strained",
  "🙂": "Okay",
  "😊": "Focused",
  "🤩": "Energized",
};

function normalizeMood(mood: string) {
  return legacyMoodLabels[mood] || mood;
}

export default function MoodSelector() {
  const supabase = createClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadTodaysMood() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("daily_checkins")
        .select("mood")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      if (data?.mood) setSelected(normalizeMood(data.mood));
    }
    loadTodaysMood();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveMood(mood: string) {
    if (saving) return;
    setSelected(mood);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("daily_checkins").upsert(
      { user_id: user.id, mood, date: today },
      { onConflict: "user_id,date" }
    );
    setSaving(false);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {MOODS.map((mood) => (
        <button
          key={mood}
          type="button"
          onClick={() => saveMood(mood)}
          className={`rounded-pill border px-3 py-2 text-xs font-medium transition-colors ${
            selected === mood
              ? "border-primary bg-primary-light text-primary"
              : "border-border bg-white text-ink-mid hover:border-primary-mid hover:text-ink"
          }`}
          aria-pressed={selected === mood}
        >
          {mood}
        </button>
      ))}
    </div>
  );
}
