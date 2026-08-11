import { Suspense } from "react";
import { redirect } from "next/navigation";
import SignupForm from "@/components/auth/SignupForm";
import { isBetaInviteOnly } from "@/lib/beta-access";

function Loading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function SignupPage() {
  if (isBetaInviteOnly()) redirect("/beta");
  return <Suspense fallback={<Loading />}><SignupForm /></Suspense>;
}
