import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { hasCurrentBetaConsent } from "@/lib/beta-consent";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.first_login_complete || !hasCurrentBetaConsent(profile)) {
    redirect("/auth/profile-setup");
  }

  return (
    <DashboardShell profile={profile} userEmail={user.email || ""}>
      {children}
    </DashboardShell>
  );
}
