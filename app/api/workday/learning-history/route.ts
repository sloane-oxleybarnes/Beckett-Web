import { NextResponse } from "next/server";
import { workdayRepository } from "@/lib/repositories/workday-repository";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  // These are the records used only for private learning. This intentionally
  // leaves saved support plans and completed Practice sessions intact.
  const [actions, summaries] = await Promise.all([
    workdayRepository.from("workday_support_actions").delete().eq("user_id", user.id),
    workdayRepository.from("workday_pattern_summaries").delete().eq("user_id", user.id),
  ]);
  if (actions.error || summaries.error) return NextResponse.json({ error: "Could not clear private learning history." }, { status: 500 });

  const { error } = await workdayRepository.from("workday_checkins").delete().eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not clear private learning history." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
