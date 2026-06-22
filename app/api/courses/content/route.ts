import { NextRequest, NextResponse } from "next/server";
import { getPublishedCourse } from "@/lib/course-content";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function requireCourseAccess() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "pro" && profile?.plan !== "beta") {
    return { ok: false as const, status: 403, error: "Courses require a Pro or Beta plan." };
  }

  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  const access = await requireCourseAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const courseId = req.nextUrl.searchParams.get("id")?.trim();
  if (!courseId) {
    return NextResponse.json({ error: "Course ID is required." }, { status: 400 });
  }

  const course = await getPublishedCourse(courseId);
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  return NextResponse.json({ course });
}
