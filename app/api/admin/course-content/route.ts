import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCourse } from "@/lib/courses";
import {
  getCourseStudioItems,
  isCourse,
  type CourseIllustration,
  type CourseSection,
} from "@/lib/course-content";
import { supabaseAdmin } from "@/lib/server-admin";
import type { Course } from "@/lib/courses";

export const dynamic = "force-dynamic";

function isAdmin() {
  return cookies().get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

function jsonCourseCopy(course: Course): Course {
  return JSON.parse(JSON.stringify(course)) as Course;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeSection(value: unknown): CourseSection {
  return value === "Personal" ? "Personal" : "Professional";
}

function normalizeIllustration(value: unknown): CourseIllustration {
  return value === "date" || value === "colleague" || value === "clarity" || value === "no"
    ? value
    : "clarity";
}

async function getDraftOrFallback(courseId: string) {
  const { data, error } = await supabaseAdmin
    .from("course_content")
    .select("draft_json,published_json")
    .eq("course_id", courseId)
    .maybeSingle();

  if (!error) {
    if (isCourse(data?.draft_json)) return data.draft_json;
    if (isCourse(data?.published_json)) return data.published_json;
  }

  return getCourse(courseId);
}

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courses = await getCourseStudioItems();
  return NextResponse.json({ courses });
}

export async function PUT(req: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const draft = body.draft as unknown;
  const courseId = normalizeSlug(String(body.courseId || ""));

  if (!courseId || !isCourse(draft)) {
    return NextResponse.json({ error: "A valid course draft is required." }, { status: 400 });
  }

  const normalizedDraft = jsonCourseCopy(draft);
  normalizedDraft.id = courseId;

  const { error } = await supabaseAdmin.from("course_content").upsert({
    course_id: courseId,
    title: normalizedDraft.title,
    section: normalizeSection(body.section),
    illustration: normalizeIllustration(body.illustration),
    is_listed: Boolean(body.isListed ?? true),
    sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100,
    source_course_id: body.sourceCourseId ? normalizeSlug(String(body.sourceCourseId)) : null,
    draft_json: normalizedDraft,
    updated_at: new Date().toISOString(),
  }, { onConflict: "course_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const courses = await getCourseStudioItems();
  return NextResponse.json({ ok: true, courses });
}

export async function POST(req: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "publish") {
    const courseId = normalizeSlug(String(body.courseId || ""));
    if (!courseId) return NextResponse.json({ error: "courseId is required." }, { status: 400 });

    const draft = await getDraftOrFallback(courseId);
    if (!draft) return NextResponse.json({ error: "Course draft not found." }, { status: 404 });

    const published = jsonCourseCopy(draft);
    published.id = courseId;

    const { data: existing } = await supabaseAdmin
      .from("course_content")
      .select("section,illustration,is_listed,sort_order,source_course_id")
      .eq("course_id", courseId)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("course_content").upsert({
      course_id: courseId,
      title: published.title,
      section: normalizeSection(existing?.section),
      illustration: normalizeIllustration(existing?.illustration),
      is_listed: Boolean(existing?.is_listed ?? true),
      sort_order: Number.isFinite(Number(existing?.sort_order)) ? Number(existing?.sort_order) : 100,
      source_course_id: existing?.source_course_id || null,
      draft_json: published,
      published_json: published,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "course_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const courses = await getCourseStudioItems();
    return NextResponse.json({ ok: true, courses });
  }

  if (action === "duplicate") {
    const sourceCourseId = normalizeSlug(String(body.sourceCourseId || ""));
    const requestedCourseId = normalizeSlug(String(body.courseId || ""));
    const title = String(body.title || "").trim();
    if (!sourceCourseId || !requestedCourseId || !title) {
      return NextResponse.json({ error: "Source course, new course ID, and title are required." }, { status: 400 });
    }

    const existing = await getDraftOrFallback(requestedCourseId);
    if (existing) {
      return NextResponse.json({ error: "That course ID already exists." }, { status: 409 });
    }

    const source = await getDraftOrFallback(sourceCourseId);
    if (!source) return NextResponse.json({ error: "Source course not found." }, { status: 404 });

    const draft = jsonCourseCopy(source);
    draft.id = requestedCourseId;
    draft.title = title;

    const { error } = await supabaseAdmin.from("course_content").insert({
      course_id: requestedCourseId,
      title,
      section: normalizeSection(body.section),
      illustration: normalizeIllustration(body.illustration),
      is_listed: false,
      sort_order: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100,
      source_course_id: sourceCourseId,
      draft_json: draft,
      published_json: null,
      updated_at: new Date().toISOString(),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const courses = await getCourseStudioItems();
    return NextResponse.json({ ok: true, courses, courseId: requestedCourseId });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
