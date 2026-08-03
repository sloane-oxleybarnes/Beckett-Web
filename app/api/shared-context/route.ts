import { NextResponse } from "next/server";
import { fetchSharedWebContext } from "@/lib/shared-web-context";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const context = await fetchSharedWebContext(supabase, user.id);
  // The browser receives the transparent account summary, never the internal AI prompt.
  return NextResponse.json({
    context: {
      version: context.version,
      surfaces: context.surfaces,
      profile: context.profile,
      choices: context.choices,
      connectedTools: context.connectedTools,
      savedContext: context.savedContext,
      retention: context.retention,
    },
  });
}
