import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { getPublishedCourse } from "@/lib/course-content";
import { requireUser } from "@/lib/server-auth";
import { ensureWebCourseAccess, WebCourseLimitError } from "@/lib/web-credits";

const CourseClient = dynamic(() => import("@/components/courses/CourseClient"), {
  loading: () => (
    <div className="mx-auto max-w-5xl animate-pulse px-4 py-10" aria-label="Loading course">
      <div className="h-8 w-2/3 rounded bg-slate-200" />
      <div className="mt-6 h-80 rounded-2xl bg-slate-100" />
    </div>
  ),
});

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser().catch(() => redirect("/auth/login"));
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  try {
    await ensureWebCourseAccess(user.id, profile?.plan || "free", id);
  } catch (error) {
    if (error instanceof WebCourseLimitError) redirect("/dashboard/skills?courseLimit=1");
    throw error;
  }

  const course = await getPublishedCourse(id);
  if (!course) notFound();

  return <CourseClient initialCourse={course} />;
}
