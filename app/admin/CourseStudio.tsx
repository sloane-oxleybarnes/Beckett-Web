"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  CourseCatalogItem,
  CourseIllustration,
  CourseSection,
  CourseStudioItem,
} from "@/lib/course-content";
import type { Course } from "@/lib/courses";

type PathPart = string | number;
type TextField = {
  path: PathPart[];
  label: string;
  value: string;
};

const ILLUSTRATIONS: CourseIllustration[] = ["clarity", "colleague", "date", "no"];
const SECTIONS: CourseSection[] = ["Professional", "Personal"];

function copyCourse(course: Course): Course {
  return JSON.parse(JSON.stringify(course)) as Course;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatJson(course: Course) {
  return JSON.stringify(course, null, 2);
}

function pathToLabel(path: PathPart[]) {
  return path
    .map((part) => typeof part === "number" ? `[${part + 1}]` : part)
    .join(".");
}

function collectTextFields(value: unknown, path: PathPart[] = []): TextField[] {
  if (typeof value === "string") {
    const key = String(path.at(-1) || "");
    if (!path.length || key === "id") return [];
    return [{ path, label: pathToLabel(path), value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectTextFields(item, [...path, index]));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      collectTextFields(item, [...path, key])
    );
  }

  return [];
}

function setValueAtPath(source: Course, path: PathPart[], value: string): Course {
  const next = copyCourse(source) as Record<string, unknown>;
  let cursor: Record<string, unknown> | unknown[] = next;
  path.forEach((part, index) => {
    if (index === path.length - 1) {
      if (Array.isArray(cursor) && typeof part === "number") cursor[part] = value;
      else if (!Array.isArray(cursor)) cursor[String(part)] = value;
      return;
    }
    cursor = Array.isArray(cursor) && typeof part === "number"
      ? cursor[part] as Record<string, unknown> | unknown[]
      : (cursor as Record<string, unknown>)[String(part)] as Record<string, unknown> | unknown[];
  });
  return next as Course;
}

function updateCourse(course: Course, updater: (draft: Course) => void) {
  const next = copyCourse(course);
  updater(next);
  return next;
}

function isTextarea(value: string) {
  return value.length > 80 || value.includes("\n");
}

function itemToCatalog(item: CourseStudioItem): CourseCatalogItem {
  return {
    id: item.courseId,
    title: item.published?.title || item.draft.title,
    description: item.published?.description || item.draft.description,
    href: `/dashboard/courses/${item.courseId}`,
    status: "live",
    level: "Foundational",
    estimatedMinutes: item.published?.estimatedMinutes || item.draft.estimatedMinutes,
    courseId: item.courseId,
    illustration: item.illustration,
    section: item.section,
    sortOrder: item.sortOrder,
  };
}

export default function AdminCourseStudio({ courses: initialCourses }: { courses: CourseStudioItem[] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [selectedId, setSelectedId] = useState(initialCourses[0]?.courseId || "");
  const selected = courses.find((course) => course.courseId === selectedId) || courses[0] || null;
  const [draft, setDraft] = useState<Course | null>(selected ? copyCourse(selected.draft) : null);
  const [jsonText, setJsonText] = useState(selected ? formatJson(selected.draft) : "");
  const [section, setSection] = useState<CourseSection>(selected?.section || "Professional");
  const [illustration, setIllustration] = useState<CourseIllustration>(selected?.illustration || "clarity");
  const [isListed, setIsListed] = useState(Boolean(selected?.isListed ?? true));
  const [sortOrder, setSortOrder] = useState(String(selected?.sortOrder ?? 100));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "published" | "duplicated" | "error">("idle");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [duplicateId, setDuplicateId] = useState("");

  useEffect(() => {
    if (!selected) return;
    setDraft(copyCourse(selected.draft));
    setJsonText(formatJson(selected.draft));
    setSection(selected.section);
    setIllustration(selected.illustration);
    setIsListed(selected.isListed);
    setSortOrder(String(selected.sortOrder));
    setStatus("idle");
    setError("");
    setSearch("");
    setDuplicateTitle(`${selected.draft.title} copy`);
    setDuplicateId(slugify(`${selected.courseId}-copy`));
  }, [selected]);

  const textFields = useMemo(() => {
    if (!draft) return [];
    const query = search.trim().toLowerCase();
    const fields = collectTextFields(draft);
    if (!query) return fields;
    return fields.filter((field) =>
      field.label.toLowerCase().includes(query) || field.value.toLowerCase().includes(query)
    );
  }, [draft, search]);

  function replaceDraft(next: Course) {
    setDraft(next);
    setJsonText(formatJson(next));
    setStatus("idle");
  }

  function updateTopLevel<K extends keyof Course>(key: K, value: Course[K]) {
    if (!draft) return;
    replaceDraft(updateCourse(draft, (next) => {
      next[key] = value;
    }));
  }

  function updateOpenPractice(key: keyof Course["openPractice"], value: string) {
    if (!draft) return;
    replaceDraft(updateCourse(draft, (next) => {
      next.openPractice = {
        ...next.openPractice,
        [key]: value,
      };
    }));
  }

  function updateTextField(field: TextField, value: string) {
    if (!draft) return;
    replaceDraft(setValueAtPath(draft, field.path, value));
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as Course;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.slides)) {
        throw new Error("JSON must be a full course object with slides.");
      }
      replaceDraft(parsed);
      setError("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Invalid JSON.");
    }
  }

  async function saveDraft(options?: { quiet?: boolean }) {
    if (!selected || !draft) return false;
    setSaving(true);
    setStatus("idle");
    setError("");

    const res = await fetch("/api/admin/course-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId: selected.courseId,
        draft: { ...draft, id: selected.courseId },
        section,
        illustration,
        isListed,
        sortOrder: Number(sortOrder),
        sourceCourseId: selected.sourceCourseId,
      }),
    });

    const data = await res.json().catch(() => ({})) as { courses?: CourseStudioItem[]; error?: string };
    setSaving(false);

    if (!res.ok) {
      setStatus("error");
      setError(data.error || "Could not save draft.");
      return false;
    }

    if (data.courses) setCourses(data.courses);
    if (!options?.quiet) setStatus("saved");
    return true;
  }

  async function publishDraft() {
    if (!selected) return;
    const saved = await saveDraft({ quiet: true });
    if (!saved) return;

    setSaving(true);
    const res = await fetch("/api/admin/course-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish", courseId: selected.courseId }),
    });
    const data = await res.json().catch(() => ({})) as { courses?: CourseStudioItem[]; error?: string };
    setSaving(false);

    if (!res.ok) {
      setStatus("error");
      setError(data.error || "Could not publish course.");
      return;
    }

    if (data.courses) setCourses(data.courses);
    setStatus("published");
  }

  async function duplicateCourse() {
    if (!selected) return;
    const nextTitle = duplicateTitle.trim();
    const nextId = slugify(duplicateId || nextTitle);
    if (!nextTitle || !nextId) {
      setStatus("error");
      setError("Add a title and course ID for the duplicate.");
      return;
    }

    setSaving(true);
    setStatus("idle");
    setError("");
    const res = await fetch("/api/admin/course-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "duplicate",
        sourceCourseId: selected.courseId,
        courseId: nextId,
        title: nextTitle,
        section,
        illustration,
        sortOrder: Number(sortOrder) + 10,
      }),
    });
    const data = await res.json().catch(() => ({})) as { courses?: CourseStudioItem[]; courseId?: string; error?: string };
    setSaving(false);

    if (!res.ok) {
      setStatus("error");
      setError(data.error || "Could not duplicate course.");
      return;
    }

    if (data.courses) setCourses(data.courses);
    if (data.courseId) setSelectedId(data.courseId);
    setStatus("duplicated");
  }

  if (!selected || !draft) {
    return (
      <div className="mt-10 rounded-card border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">Course Studio</h2>
        <p className="mt-2 text-sm text-ink-mid">No courses found.</p>
      </div>
    );
  }

  const previewCourse = itemToCatalog({
    ...selected,
    section,
    illustration,
    isListed,
    sortOrder: Number(sortOrder),
    draft,
  });

  return (
    <div className="mt-10 max-w-6xl">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Course Studio</h2>
          <p className="text-sm text-ink-mid">
            Edit course drafts, publish when ready, or duplicate a course into a new editable draft.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {status === "saved" && <span className="text-xs text-green-700">Draft saved.</span>}
          {status === "published" && <span className="text-xs text-green-700">Published.</span>}
          {status === "duplicated" && <span className="text-xs text-green-700">Duplicated.</span>}
          {status === "error" && <span className="text-xs text-red-600">{error}</span>}
          <button
            type="button"
            onClick={() => saveDraft()}
            disabled={saving}
            className="rounded-pill border border-border bg-white px-5 py-2.5 text-xs font-medium text-ink transition-colors hover:border-primary disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save draft"}
          </button>
          <button
            type="button"
            onClick={publishDraft}
            disabled={saving}
            className="rounded-pill bg-primary px-5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-card border border-border bg-white p-4">
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-light">
              Course
            </span>
            <select
              value={selected.courseId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {courses.map((course) => (
                <option key={course.courseId} value={course.courseId}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2 rounded-sm bg-bg p-3 text-xs text-ink-mid">
            <p><strong>ID:</strong> {selected.courseId}</p>
            <p><strong>Source:</strong> {selected.hasCodeFallback ? "Code fallback" : selected.sourceCourseId || "Admin"}</p>
            <p><strong>Published:</strong> {selected.publishedAt ? new Date(selected.publishedAt).toLocaleString() : "Not yet"}</p>
            <p><strong>Listed:</strong> {isListed ? "Yes" : "No"}</p>
            <Link href={previewCourse.href} className="inline-block text-primary hover:underline">
              Open course
            </Link>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">Duplicate</h3>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-light">
                New title
              </span>
              <input
                value={duplicateTitle}
                onChange={(event) => {
                  setDuplicateTitle(event.target.value);
                  setDuplicateId(slugify(event.target.value));
                }}
                className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-light">
                New course ID
              </span>
              <input
                value={duplicateId}
                onChange={(event) => setDuplicateId(slugify(event.target.value))}
                className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <button
              type="button"
              onClick={duplicateCourse}
              disabled={saving}
              className="w-full rounded-pill border border-primary px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              Duplicate as draft
            </button>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">Publishing settings</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-light">
                  Section
                </span>
                <select
                  value={section}
                  onChange={(event) => setSection(event.target.value as CourseSection)}
                  className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {SECTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-light">
                  Illustration
                </span>
                <select
                  value={illustration}
                  onChange={(event) => setIllustration(event.target.value as CourseIllustration)}
                  className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {ILLUSTRATIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-light">
                  Sort order
                </span>
                <input
                  value={sortOrder}
                  type="number"
                  onChange={(event) => setSortOrder(event.target.value)}
                  className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={isListed}
                  onChange={(event) => setIsListed(event.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                Show in Skills
              </label>
            </div>
          </section>

          <section className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">Course basics</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Title"
                value={draft.title}
                onChange={(value) => updateTopLevel("title", value)}
              />
              <TextInput
                label="Estimated minutes"
                value={String(draft.estimatedMinutes)}
                type="number"
                onChange={(value) => updateTopLevel("estimatedMinutes", Number(value) || 0)}
              />
              <TextInput
                label="Description"
                value={draft.description}
                textarea
                onChange={(value) => updateTopLevel("description", value)}
              />
              <TextInput
                label="Confidence intro"
                value={draft.confidenceIntro}
                textarea
                onChange={(value) => updateTopLevel("confidenceIntro", value)}
              />
              <TextInput
                label="Confidence question"
                value={draft.confidenceQuestion}
                textarea
                onChange={(value) => updateTopLevel("confidenceQuestion", value)}
              />
              <TextInput
                label="Reflective question"
                value={draft.reflectiveQuestion}
                textarea
                onChange={(value) => updateTopLevel("reflectiveQuestion", value)}
              />
            </div>
          </section>

          <section className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">Open practice</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {(["matchName", "matchDescription", "subtitle", "introTitle", "introDescription", "goal", "systemPrompt"] as const).map((key) => (
                <TextInput
                  key={key}
                  label={key}
                  value={String(draft.openPractice[key] || "")}
                  textarea={key === "systemPrompt" || key === "introDescription" || key === "goal"}
                  onChange={(value) => updateOpenPractice(key, value)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-card border border-border bg-white p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">All editable text</h3>
                <p className="text-xs text-ink-mid">
                  Search for slide copy, options, explanations, prompts, or practice messages.
                </p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search text fields"
                className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary sm:max-w-xs"
              />
            </div>
            <div className="max-h-[640px] space-y-4 overflow-y-auto pr-2">
              {textFields.map((field) => (
                <label key={field.label} className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-light">
                    {field.label}
                  </span>
                  {isTextarea(field.value) ? (
                    <textarea
                      value={field.value}
                      rows={Math.min(Math.max(field.value.split("\n").length + 2, 3), 8)}
                      onChange={(event) => updateTextField(field, event.target.value)}
                      className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  ) : (
                    <input
                      value={field.value}
                      onChange={(event) => updateTextField(field, event.target.value)}
                      className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-border bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">Advanced JSON</h3>
                <p className="text-xs text-ink-mid">Use this for structural edits that the form does not expose yet.</p>
              </div>
              <button
                type="button"
                onClick={applyJson}
                className="rounded-pill border border-border px-4 py-2 text-xs font-medium text-ink hover:border-primary"
              >
                Apply JSON
              </button>
            </div>
            <textarea
              value={jsonText}
              rows={18}
              spellCheck={false}
              onChange={(event) => setJsonText(event.target.value)}
              className="w-full rounded-sm border border-border bg-[#171614] px-3 py-2 font-mono text-xs leading-relaxed text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  textarea = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-light">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ) : (
        <input
          value={value}
          type={type}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}
    </label>
  );
}
