import { COURSES, getCourse, type Course } from "@/lib/courses";
import { supabaseAdmin } from "@/lib/server-admin";

export type CourseIllustration = "date" | "colleague" | "clarity" | "no";
export type CourseSection = "Professional" | "Personal";

export type CourseContentRow = {
  course_id: string;
  title: string;
  section: CourseSection | string;
  illustration: CourseIllustration | string;
  is_listed: boolean;
  sort_order: number;
  source_course_id: string | null;
  draft_json: Course;
  published_json: Course | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type CourseStudioItem = {
  courseId: string;
  title: string;
  section: CourseSection;
  illustration: CourseIllustration;
  isListed: boolean;
  sortOrder: number;
  sourceCourseId: string | null;
  hasCodeFallback: boolean;
  hasPublishedOverride: boolean;
  updatedAt: string | null;
  publishedAt: string | null;
  draft: Course;
  published: Course | null;
};

export type CourseCatalogItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  status: "live";
  level: "Foundational";
  estimatedMinutes: number;
  courseId: string;
  illustration: CourseIllustration;
  section: CourseSection;
  sortOrder: number;
};

const STATIC_META: Record<string, {
  section: CourseSection;
  illustration: CourseIllustration;
  sortOrder: number;
}> = {
  "introducing-new-colleague": {
    section: "Professional",
    illustration: "colleague",
    sortOrder: 10,
  },
  "asking-for-clarity": {
    section: "Professional",
    illustration: "clarity",
    sortOrder: 20,
  },
  "ask-someone-out": {
    section: "Personal",
    illustration: "date",
    sortOrder: 10,
  },
};

function normalizeSection(value: unknown, fallback: CourseSection = "Professional"): CourseSection {
  return value === "Personal" ? "Personal" : value === "Professional" ? "Professional" : fallback;
}

function normalizeIllustration(value: unknown, fallback: CourseIllustration = "clarity"): CourseIllustration {
  return value === "date" || value === "colleague" || value === "clarity" || value === "no"
    ? value
    : fallback;
}

export function isCourse(value: unknown): value is Course {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Course>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.estimatedMinutes === "number" &&
    typeof candidate.confidenceQuestion === "string" &&
    typeof candidate.confidenceIntro === "string" &&
    typeof candidate.reflectiveQuestion === "string" &&
    Array.isArray(candidate.slides) &&
    Boolean(candidate.openPractice && typeof candidate.openPractice === "object") &&
    typeof candidate.reviewWrongAnswers === "boolean" &&
    typeof candidate.reviewConversationTurns === "number"
  );
}

function rowToStudioItem(row: CourseContentRow, fallback?: Course): CourseStudioItem | null {
  const draft = isCourse(row.draft_json) ? row.draft_json : fallback;
  if (!draft) return null;
  const published = isCourse(row.published_json) ? row.published_json : null;
  const meta = STATIC_META[row.course_id];
  return {
    courseId: row.course_id,
    title: row.title || draft.title,
    section: normalizeSection(row.section, meta?.section || "Professional"),
    illustration: normalizeIllustration(row.illustration, meta?.illustration || "clarity"),
    isListed: row.is_listed,
    sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : meta?.sortOrder || 100,
    sourceCourseId: row.source_course_id,
    hasCodeFallback: Boolean(fallback),
    hasPublishedOverride: Boolean(published),
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    draft,
    published,
  };
}

function staticStudioItem(course: Course): CourseStudioItem {
  const meta = STATIC_META[course.id] || {
    section: "Professional" as CourseSection,
    illustration: "clarity" as CourseIllustration,
    sortOrder: 100,
  };
  return {
    courseId: course.id,
    title: course.title,
    section: meta.section,
    illustration: meta.illustration,
    isListed: true,
    sortOrder: meta.sortOrder,
    sourceCourseId: null,
    hasCodeFallback: true,
    hasPublishedOverride: false,
    updatedAt: null,
    publishedAt: null,
    draft: course,
    published: null,
  };
}

function summarizeCourse(course: Course, meta?: Partial<CourseStudioItem>): CourseCatalogItem {
  const staticMeta = STATIC_META[course.id] || {
    section: "Professional" as CourseSection,
    illustration: "clarity" as CourseIllustration,
    sortOrder: 100,
  };
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    href: `/dashboard/courses/${course.id}`,
    status: "live",
    level: "Foundational",
    estimatedMinutes: course.estimatedMinutes,
    courseId: course.id,
    illustration: normalizeIllustration(meta?.illustration, staticMeta.illustration),
    section: normalizeSection(meta?.section, staticMeta.section),
    sortOrder: meta?.sortOrder ?? staticMeta.sortOrder,
  };
}

async function listCourseContentRows() {
  const { data, error } = await supabaseAdmin
    .from("course_content")
    .select("course_id,title,section,illustration,is_listed,sort_order,source_course_id,draft_json,published_json,created_at,updated_at,published_at")
    .order("section", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data || []) as CourseContentRow[];
}

export async function getCourseStudioItems(): Promise<CourseStudioItem[]> {
  let rows: CourseContentRow[] = [];
  try {
    rows = await listCourseContentRows();
  } catch {
    rows = [];
  }

  const byId = new Map(rows.map((row) => [row.course_id, row]));
  const items = COURSES.map((course) => {
    const row = byId.get(course.id);
    return row ? rowToStudioItem(row, course) || staticStudioItem(course) : staticStudioItem(course);
  });

  for (const row of rows) {
    if (getCourse(row.course_id)) continue;
    const item = rowToStudioItem(row);
    if (item) items.push(item);
  }

  return items.sort((a, b) => {
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}

export async function getPublishedCourse(courseId: string): Promise<Course | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .from("course_content")
      .select("published_json")
      .eq("course_id", courseId)
      .maybeSingle();

    if (!error && isCourse(data?.published_json)) return data.published_json;
  } catch {
    // Fall back to code-backed courses when the admin table is unavailable.
  }

  return getCourse(courseId);
}

export async function getPublishedCourseCatalog(): Promise<CourseCatalogItem[]> {
  let rows: CourseContentRow[] = [];
  try {
    rows = await listCourseContentRows();
  } catch {
    rows = [];
  }

  const byId = new Map(rows.map((row) => [row.course_id, row]));
  const catalog = COURSES.map((course) => {
    const row = byId.get(course.id);
    const published = isCourse(row?.published_json) ? row?.published_json : course;
    return summarizeCourse(published, {
      section: normalizeSection(row?.section, STATIC_META[course.id]?.section || "Professional"),
      illustration: normalizeIllustration(row?.illustration, STATIC_META[course.id]?.illustration || "clarity"),
      sortOrder: row?.sort_order ?? STATIC_META[course.id]?.sortOrder ?? 100,
    });
  });

  for (const row of rows) {
    if (!row.is_listed || getCourse(row.course_id) || !isCourse(row.published_json)) continue;
    catalog.push(summarizeCourse(row.published_json, {
      section: normalizeSection(row.section),
      illustration: normalizeIllustration(row.illustration),
      sortOrder: row.sort_order,
    }));
  }

  return catalog.sort((a, b) => {
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}
