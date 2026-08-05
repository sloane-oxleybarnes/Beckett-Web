import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json(
    { authenticated: Boolean(user), email: user?.email || null },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
