"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  neurodivergentContextOptions,
  strengthOptions,
  workplaceTriggerOptions,
} from "@/lib/onboarding";

type AboutData = {
  communication_style: string;
  triggers: string;
  how_i_work_best: string;
};

type ToolkitItem = {
  id: string;
  course_id: string;
  category: string;
  label: string;
  content: string;
  created_at: string;
};

const toolkitCourseTitles: Record<string, string> = {
  "introducing-new-colleague": "Introducing Yourself to a New Colleague",
  "ask-someone-out": "Asking Someone Out on a Dating App",
  "asking-for-clarity": "Asking for Clarity at Work",
};

function toggleValue(list: string[], value: string, max?: number) {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (max && list.length >= max) return list;
  return [...list, value];
}

function splitCustomEntries(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeCustomEntries(list: string[], value: string, max?: number) {
  const next = [...list];
  const existing = new Set(next.map((item) => item.toLowerCase()));

  for (const entry of splitCustomEntries(value)) {
    if (max && next.length >= max) break;
    const key = entry.toLowerCase();
    if (existing.has(key)) continue;
    next.push(entry);
    existing.add(key);
  }

  return next;
}

function getCustomValues(values: string[], presetOptions: string[]) {
  const presets = new Set(presetOptions.map((item) => item.toLowerCase()));
  return values.filter((value) => !presets.has(value.toLowerCase()));
}

function OptionButton({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-sm border px-3 py-2 text-xs transition-colors ${
        selected
          ? "border-primary bg-primary-light text-primary"
          : "border-border bg-white text-ink hover:border-primary-mid"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {label}
    </button>
  );
}

function SummaryChips({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <p className="text-sm text-ink-light">Nothing selected yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span key={value} className="rounded-pill bg-bg px-3 py-1 text-xs text-ink-mid">
          {value}
        </span>
      ))}
    </div>
  );
}

function SummarySection({
  title,
  description,
  values,
  editing,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  values: string[];
  editing: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-card p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{title}</label>
          <p className="text-xs text-ink-light">{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      {editing ? <div>{children}</div> : <SummaryChips values={values} />}
    </div>
  );
}

function CustomEntryControls({
  value,
  onChange,
  onAdd,
  values,
  presetOptions,
  onRemove,
  disabled,
  helperText,
}: {
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  values: string[];
  presetOptions: string[];
  onRemove: (value: string) => void;
  disabled?: boolean;
  helperText?: string;
}) {
  const customValues = getCustomValues(values, presetOptions);

  return (
    <div className="mt-4 rounded-sm border border-border bg-bg/60 p-3">
      <label className="block text-xs font-medium uppercase tracking-wide text-ink-light">
        Add your own
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Separate each answer with a comma"
          className="min-w-0 flex-1 rounded-sm border border-border bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || splitCustomEntries(value).length === 0}
          className="rounded-pill border border-border bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary-mid hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {helperText && <p className="mt-2 text-xs text-ink-light">{helperText}</p>}
      {customValues.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {customValues.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onRemove(item)}
              className="rounded-pill bg-white px-3 py-1 text-xs text-ink-mid transition-colors hover:bg-red-50 hover:text-red-700"
              aria-label={`Remove ${item}`}
            >
              {item} x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TextAreaCard({
  title,
  description,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="bg-white border border-border rounded-card p-5">
      <label className="block text-sm font-medium text-ink mb-1">{title}</label>
      <p className="text-xs text-ink-light mb-3">{description}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border border-border rounded-sm px-3 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
      />
    </div>
  );
}

export default function AboutPage() {
  const supabase = createClient();
  const [data, setData] = useState<AboutData>({
    communication_style: "",
    triggers: "",
    how_i_work_best: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [workplaceTriggers, setWorkplaceTriggers] = useState<string[]>([]);
  const [neurodivergentContext, setNeurodivergentContext] = useState<string[]>([]);
  const [contextOther, setContextOther] = useState("");
  const [customStrengths, setCustomStrengths] = useState("");
  const [customTriggers, setCustomTriggers] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set());
  const [toolkitItems, setToolkitItems] = useState<ToolkitItem[]>([]);
  const [deletingToolkitId, setDeletingToolkitId] = useState<string | null>(null);
  const [toolkitFilter, setToolkitFilter] = useState("all");
  const [showAllToolkit, setShowAllToolkit] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: aboutData } = await supabase
        .from("user_about")
        .select("communication_style, triggers, how_i_work_best")
        .eq("user_id", user.id)
        .maybeSingle();
      if (aboutData) {
        setData({
          communication_style: aboutData.communication_style || "",
          triggers: aboutData.triggers || "",
          how_i_work_best: aboutData.how_i_work_best || "",
        });
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("strengths, workplace_triggers, neurodivergent_context, neurodivergent_context_other")
        .eq("id", user.id)
        .single();
      if (profile) {
        setStrengths(profile.strengths || []);
        setWorkplaceTriggers(profile.workplace_triggers || []);
        setNeurodivergentContext(profile.neurodivergent_context || []);
        setContextOther(profile.neurodivergent_context_other || "");
      }
      const toolkitRes = await fetch("/api/course-toolkit");
      if (toolkitRes.ok) {
        const toolkitData = (await toolkitRes.json().catch(() => ({}))) as { items?: ToolkitItem[] };
        setToolkitItems(toolkitData.items || []);
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("user_about").upsert(
      { user_id: user.id, ...data, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    await supabase
      .from("profiles")
      .update({
        strengths,
        workplace_triggers: workplaceTriggers,
        neurodivergent_context: neurodivergentContext,
        neurodivergent_context_other: contextOther.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function toggleSection(section: string) {
    setEditingSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function addCustomStrengths() {
    setStrengths((current) => mergeCustomEntries(current, customStrengths, 3));
    setCustomStrengths("");
  }

  function addCustomTriggers() {
    setWorkplaceTriggers((current) => mergeCustomEntries(current, customTriggers));
    setCustomTriggers("");
  }

  function addCustomContext() {
    setNeurodivergentContext((current) => mergeCustomEntries(current, customContext));
    setCustomContext("");
  }

  async function deleteToolkitItem(id: string) {
    setDeletingToolkitId(id);
    const res = await fetch("/api/course-toolkit", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setDeletingToolkitId(null);
    if (res.ok) setToolkitItems((current) => current.filter((item) => item.id !== id));
  }

  const toolkitFilters = [
    { id: "all", label: "All" },
    ...Array.from(new Set(toolkitItems.map((item) => item.course_id))).map((courseId) => ({
      id: courseId,
      label: toolkitCourseTitles[courseId] || courseId.replace(/-/g, " "),
    })),
  ];
  const filteredToolkitItems = toolkitItems.filter((item) => toolkitFilter === "all" || item.course_id === toolkitFilter);
  const visibleToolkitItems = showAllToolkit ? filteredToolkitItems : filteredToolkitItems.slice(0, 4);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl">
      <h1
        className="text-3xl text-ink mb-2"
        style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
      >
        About Me
      </h1>
      <p className="text-ink-mid text-sm mb-8">
        Help Beckett understand how you communicate. This shapes practice sessions
        and feedback.
      </p>

      <form onSubmit={save} className="space-y-5">
        <div className="bg-white border border-border rounded-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-ink mb-1">Communication toolkit</h2>
            <p className="text-xs text-ink-light">
              Phrases and questions you created in Beckett courses. Delete anything you do not want to keep.
            </p>
          </div>
          {toolkitItems.length === 0 ? (
            <p className="text-sm text-ink-light">Nothing saved yet. Course phrases will appear here after you build them.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {toolkitFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => {
                      setToolkitFilter(filter.id);
                      setShowAllToolkit(false);
                    }}
                    className={`rounded-pill border px-3 py-1.5 text-xs transition-colors ${
                      toolkitFilter === filter.id
                        ? "border-primary bg-primary-light text-primary"
                        : "border-border bg-bg text-ink-mid hover:border-primary"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {visibleToolkitItems.map((item) => (
                <div key={item.id} className="rounded-card border border-border bg-bg p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-primary">{toolkitCourseTitles[item.course_id] || item.course_id.replace(/-/g, " ")}</p>
                      <p className="text-[11px] uppercase tracking-wide text-ink-light">{item.label}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteToolkitItem(item.id)}
                      disabled={deletingToolkitId === item.id}
                      className="text-xs text-ink-light hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingToolkitId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed text-ink">{item.content}</p>
                </div>
              ))}
              {filteredToolkitItems.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllToolkit((current) => !current)}
                  className="rounded-pill border border-primary px-4 py-2 text-xs font-medium text-primary hover:bg-primary-light"
                >
                  {showAllToolkit ? "Show recent" : `View all ${filteredToolkitItems.length}`}
                </button>
              )}
            </div>
          )}
        </div>

        <SummarySection
          title="Communication strengths"
          description="Beckett starts from what already works."
          values={strengths}
          editing={editingSections.has("strengths")}
          onToggle={() => toggleSection("strengths")}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {strengthOptions.map((option) => (
              <OptionButton
                key={option}
                label={option}
                selected={strengths.includes(option)}
                onClick={() => setStrengths((current) => toggleValue(current, option))}
              />
            ))}
          </div>
          <CustomEntryControls
            value={customStrengths}
            onChange={setCustomStrengths}
            onAdd={addCustomStrengths}
            values={strengths}
            presetOptions={strengthOptions}
            onRemove={(value) => setStrengths((current) => current.filter((item) => item !== value))}
          />
        </SummarySection>

        <SummarySection
          title="My Triggers"
          description="Beckett uses this to be more careful around the moments that tend to spike stress or confusion."
          values={workplaceTriggers}
          editing={editingSections.has("triggers")}
          onToggle={() => toggleSection("triggers")}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {workplaceTriggerOptions.map((option) => (
              <OptionButton
                key={option}
                label={option}
                selected={workplaceTriggers.includes(option)}
                onClick={() => setWorkplaceTriggers((current) => toggleValue(current, option))}
              />
            ))}
          </div>
          <CustomEntryControls
            value={customTriggers}
            onChange={setCustomTriggers}
            onAdd={addCustomTriggers}
            values={workplaceTriggers}
            presetOptions={workplaceTriggerOptions}
            onRemove={(value) => setWorkplaceTriggers((current) => current.filter((item) => item !== value))}
          />
        </SummarySection>

        <TextAreaCard
          title="How I communicate"
          description="How do you naturally communicate? Direct or indirect? Verbose or brief? Comfortable with conflict or avoidant?"
          value={data.communication_style}
          onChange={(value) => setData({ ...data, communication_style: value })}
          placeholder="e.g. I tend to be indirect and avoid conflict. I over-explain when nervous. I need time to process before responding."
        />

        <SummarySection
          title="Neurodivergent context"
          description="Optional. This is never used to diagnose you; it just gives Beckett background context."
          values={[
            ...neurodivergentContext.filter((item) => item !== "Something else"),
            neurodivergentContext.includes("Something else") ? contextOther || "Something else" : "",
          ].filter(Boolean)}
          editing={editingSections.has("context")}
          onToggle={() => toggleSection("context")}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {neurodivergentContextOptions.map((option) => (
              <OptionButton
                key={option}
                label={option}
                selected={neurodivergentContext.includes(option)}
                onClick={() => setNeurodivergentContext((current) => toggleValue(current, option))}
              />
            ))}
          </div>
          {neurodivergentContext.includes("Something else") && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-ink mb-1">Something else</label>
              <input
                value={contextOther}
                onChange={(e) => setContextOther(e.target.value)}
                className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
          <CustomEntryControls
            value={customContext}
            onChange={setCustomContext}
            onAdd={addCustomContext}
            values={neurodivergentContext.filter((item) => item !== "Something else")}
            presetOptions={neurodivergentContextOptions}
            onRemove={(value) => setNeurodivergentContext((current) => current.filter((item) => item !== value))}
          />
        </SummarySection>

        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-white text-sm rounded-pill px-6 py-2.5 hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </form>
    </div>
  );
}
