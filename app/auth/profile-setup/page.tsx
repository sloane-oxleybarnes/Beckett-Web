import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { hasApprovedBetaAccess } from "@/lib/beta-access";
import ProfileSetupForm from "@/components/auth/ProfileSetupForm";

export default async function ProfileSetupPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", session.user.id)
    .maybeSingle();
  const approved = await hasApprovedBetaAccess({ email: session.user.email, plan: profile?.plan });
  if (!approved) {
    await supabase.auth.signOut();
    redirect("/beta?access=approval-required");
  }

  return <ProfileSetupForm />;
}
