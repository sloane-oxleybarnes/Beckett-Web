"use client";

import { useMemo, useState } from "react";
import { SITE_CONTENT_FIELDS } from "@/lib/site-content";

type ContentValues = Record<string, string>;

export default function AdminContentEditor({ content }: { content: ContentValues }) {
  const [values, setValues] = useState<ContentValues>(content);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    return SITE_CONTENT_FIELDS.reduce<Record<string, typeof SITE_CONTENT_FIELDS>>((acc, field) => {
      acc[field.group] = [...(acc[field.group] || []), field];
      return acc;
    }, {});
  }, []);

  async function save() {
    setSaving(true);
    setStatus("idle");
    setError("");

    const res = await fetch("/api/admin/site-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: values }),
    });

    if (res.ok) {
      setStatus("saved");
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus("error");
      setError(data.error || "Could not save content.");
    }
    setSaving(false);
  }

  function resetField(key: string) {
    const field = SITE_CONTENT_FIELDS.find((item) => item.key === key);
    if (!field) return;
    setValues((prev) => ({ ...prev, [key]: field.defaultValue }));
  }

  return (
    <div className="mt-10 max-w-4xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Website content</h2>
          <p className="text-sm text-ink-mid">
            Edit simple website text. Empty saved fields will show as empty, so use reset to restore defaults.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status === "saved" && <span className="text-xs text-green-700">Saved.</span>}
          {status === "error" && <span className="text-xs text-red-600">{error}</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-primary text-white text-xs font-medium rounded-pill px-5 py-2.5 hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {Object.entries(groups).map(([group, fields]) => (
          <section key={group} className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">{group}</h3>
            <div className="space-y-4">
              {fields.map((field) => {
                const value = values[field.key] ?? field.defaultValue;
                return (
                  <label key={field.key} className="block">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium uppercase tracking-wide text-ink-light">
                        {field.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => resetField(field.key)}
                        className="text-xs text-primary hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                    {field.inputType === "textarea" ? (
                      <textarea
                        value={value}
                        rows={3}
                        onChange={(event) =>
                          setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                        }
                        className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <input
                        value={value}
                        type={field.inputType === "url" ? "url" : "text"}
                        onChange={(event) =>
                          setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                        }
                        className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
