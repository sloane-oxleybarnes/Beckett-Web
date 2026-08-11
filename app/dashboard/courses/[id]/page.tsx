import { notFound, redirect } from "next/navigation";
import CourseClient from "@/components/courses/CourseClient";
import { getPublishedCourse } from "@/lib/course-content";
import { requireUser } from "@/lib/server-auth";
import { ensureWebCourseAccess, WebCourseLimitError } from "@/lib/web-credits";

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
