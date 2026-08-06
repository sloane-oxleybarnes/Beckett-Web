import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { isBetaInviteOnly } from "@/lib/beta-access";

const SignupForm = dynamic(() => import("@/components/auth/SignupForm"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function SignupPage() {
  if (isBetaInviteOnly()) redirect("/beta");
  return <SignupForm />;
}
