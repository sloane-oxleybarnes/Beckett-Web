import { Suspense } from "react";
import { redirect } from "next/navigation";
import ProfileSetupForm from "@/components/auth/ProfileSetupForm";
import { requireUser } from "@/lib/server-auth";
import { hasApprovedBetaAccess } from "@/lib/beta-access";

function Loading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default async function ProfileSetupPage() {
  const { supabase, user } = await requireUser().catch(() => redirect("/auth/login"));

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const approved = await hasApprovedBetaAccess({ email: user.email, plan: profile?.plan });
  if (!approved) {
    await supabase.auth.signOut();
    redirect("/beta?access=approval-required");
  }

  return <Suspense fallback={<Loading />}><ProfileSetupForm /></Suspense>;
}
