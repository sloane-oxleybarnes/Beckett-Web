import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server-auth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { ensureApprovedBetaPlan, hasApprovedBetaAccess } from "@/lib/beta-access";
import { hasCurrentBetaConsent } from "@/lib/beta-consent";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requireUser().catch(() => redirect("/auth/login"));

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const approved = await hasApprovedBetaAccess({
    email: user.email,
    plan: profile?.plan,
  });
  if (!approved) {
    await supabase.auth.signOut();
    redirect("/beta?access=approval-required");
  }

  const effectivePlan = await ensureApprovedBetaPlan({
    userId: user.id,
    email: user.email,
    plan: profile?.plan,
  });
  const effectiveProfile = profile ? { ...profile, plan: effectivePlan } : profile;

  if (!effectiveProfile?.first_login_complete || !hasCurrentBetaConsent(effectiveProfile)) {
    redirect("/auth/profile-setup");
  }

  return (
    <DashboardShell profile={effectiveProfile} userEmail={user.email || ""}>
      {children}
    </DashboardShell>
  );
}
