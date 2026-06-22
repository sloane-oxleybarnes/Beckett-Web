import { NextResponse } from "next/server";
import { getPublishedCourseCatalog } from "@/lib/course-content";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "pro" && profile?.plan !== "beta") {
    return NextResponse.json({ error: "Courses require a Pro or Beta plan." }, { status: 403 });
  }

  const courses = await getPublishedCourseCatalog();
  return NextResponse.json({ courses });
}
