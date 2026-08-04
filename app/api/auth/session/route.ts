import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Small, non-sensitive session probe used by the Outlook task pane.
 * The task pane cannot assume that Outlook and the user's browser share the
 * same cookie jar, so it needs a clear signed-in state before it sends mail
 * content to Beckett. No token or profile data is returned here.
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json(
    { authenticated: Boolean(user), email: user?.email || null },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
