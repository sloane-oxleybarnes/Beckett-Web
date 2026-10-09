import { NextRequest, NextResponse } from "next/server";
import {
  getPublishedCourse,
  getPublishedCourseCatalog,
  type CourseCatalogItem,
} from "@/lib/course-content";
import type { CourseSlide } from "@/lib/courses";
import { getMobileUser } from "@/lib/mobile-auth";
import { platformRepository } from "@/lib/repositories/platform-repository";
import {
  WEB_CREDITS_ENABLED,
  canBrowseWebCourses,
  ensureWebCourseAccess,
  WebCourseLimitError,
} from "@/lib/web-credits";

export const dynamic = "force-dynamic";

type CourseBody = {
  operation?: unknown;
  courseId?: unknown;
  currentLessonIndex?: unknown;
  progressPercent?: unknown;
  completed?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
async function accessFor(userId: string) {
  const { data: profile } = await platformRepository
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  const plan = profile?.plan || "free";
  return { plan, allowed: !WEB_CREDITS_ENABLED || await canBrowseWebCourses(plan) };
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function lessonFromSlide(slide: CourseSlide, index: number) {
  const value = slide as unknown as Record<string, unknown>;
  const body = [
    value.description,
    value.intro,
    value.draftContext,
  ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);

  const bullets = [
    ...strings(value.bullets),
    ...strings(value.stats),
    ...strings(value.helperChecklist),
  ];

  const records = (candidate: unknown) => Array.isArray(candidate)
    ? candidate.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
  const text = (candidate: unknown) => typeof candidate === "string" ? candidate : null;
  const choices = (candidate: unknown) => Array.isArray(candidate)
    ? candidate.map((item) => {
      if (typeof item === "string") return { text: item, correct: null, explanation: null };
      const option = item as Record<string, unknown>;
      return {
        text: text(option.text) || "",
        correct: typeof option.correct === "boolean" ? option.correct : null,
        explanation: text(option.explanation),
      };
    }).filter((item) => item.text)
    : [];

  return {
    id: `lesson-${index + 1}`,
    title: slide.title,
    type: slide.type,
    body,
    bullets,
    instruction: text(value.instruction),
    prompt: text(value.prompt),
    scenario: text(value.scenario),
    sections: records(value.sections).map((section) => ({
      heading: text(section.heading) || "",
      bullets: strings(section.bullets),
      examples: strings(section.examples),
    })),
    cards: records(value.cards).map((card) => ({
      front: text(card.front) || "",
      back: strings(card.back),
    })),
    steps: records(value.steps).map((step) => ({
      label: text(step.label) || "",
      text: text(step.text) || "",
      example: text(step.example),
    })),
    rounds: records(value.rounds).map((round) => ({
      scenario: text(round.scenario) || "",
      question: text(round.question),
      explanation: text(round.explanation),
      options: choices(round.options),
    })),
    items: Array.isArray(value.items) ? value.items.map((item) => {
      if (typeof item === "string") return { text: item, correct: null, explanation: null };
      const record = item as Record<string, unknown>;
      return {
        text: text(record.message) || text(record.text) || "",
        correct: text(record.correct),
        explanation: text(record.explanation),
      };
    }).filter((item) => item.text) : [],
    options: choices(value.options),
    fields: records(value.fields).map((field) => ({
      key: text(field.key) || "",
      label: text(field.label) || "",
      placeholder: text(field.placeholder),
      options: strings(field.options),
      multi: field.multi === true,
    })),
    pairs: records(value.pairs).map((pair) => {
      const left = pair.left as Record<string, unknown> | undefined;
      const right = pair.right as Record<string, unknown> | undefined;
      return {
        left: [text(left?.name), text(left?.description)].filter(Boolean).join(": "),
        right: [text(right?.name), text(right?.description)].filter(Boolean).join(": "),
      };
    }),
    comparison: value.good && value.bad ? {
      good: value.good,
      bad: value.bad,
    } : null,
  };
}

function withStatus(catalog: CourseCatalogItem[], progressRows: Array<{ course_id: string; progress_percent: number | null }>, completedRows: Array<{ course_id: string }>) {
  const progress = new Map(progressRows.map((row) => [row.course_id, row.progress_percent || 0]));
  const completed = new Set(completedRows.map((row) => row.course_id));
  return catalog.map((course) => ({
    ...course,
    progressPercent: completed.has(course.id) ? 100 : progress.get(course.id) || 0,
    completed: completed.has(course.id),
  }));
}

export async function GET(request: NextRequest) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const access = await accessFor(user.id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Courses require Beta or Pro access." }, { status: 403 });
  }

  const [catalog, progressResult, completionResult] = await Promise.all([
    getPublishedCourseCatalog(),
    platformRepository
      .from("course_progress")
      .select("course_id,progress_percent")
      .eq("user_id", user.id),
    platformRepository
      .from("course_completions")
      .select("course_id")
      .eq("user_id", user.id),
  ]);

  return NextResponse.json({
    courses: withStatus(
      catalog,
      progressResult.data || [],
      completionResult.data || [],
    ),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as CourseBody | null;
  const courseId = clean(body?.courseId, 160);
  if (!courseId) return NextResponse.json({ error: "Course is required." }, { status: 400 });

  const access = await accessFor(user.id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Courses require Beta or Pro access." }, { status: 403 });
  }
  if (WEB_CREDITS_ENABLED) {
    try {
      await ensureWebCourseAccess(user.id, access.plan, courseId);
    } catch (error) {
      if (error instanceof WebCourseLimitError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }

  if (body?.operation === "content") {
    const course = await getPublishedCourse(courseId);
    if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        estimatedMinutes: course.estimatedMinutes,
        lessons: course.slides.map(lessonFromSlide),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (body?.operation === "progress") {
    const completed = body.completed === true;
    if (completed) {
      const { error } = await platformRepository
        .from("course_completions")
        .upsert({
          user_id: user.id,
          course_id: courseId,
          completed_at: new Date().toISOString(),
        }, { onConflict: "user_id,course_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await platformRepository
        .from("course_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("course_id", courseId);
      return NextResponse.json({ completed: true, progressPercent: 100 });
    }

    const lessonIndex = Math.max(0, Math.floor(Number(body.currentLessonIndex) || 0));
    const progressPercent = Math.min(99, Math.max(0, Math.floor(Number(body.progressPercent) || 0)));
    const { error } = await platformRepository
      .from("course_progress")
      .upsert({
        user_id: user.id,
        course_id: courseId,
        phase: "slides",
        current_slide_index: lessonIndex,
        progress_percent: progressPercent,
        activity_state: { mobile: true },
        saved_at: new Date().toISOString(),
      }, { onConflict: "user_id,course_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ completed: false, progressPercent });
  }

  return NextResponse.json({ error: "Choose a supported course operation." }, { status: 400 });
}
