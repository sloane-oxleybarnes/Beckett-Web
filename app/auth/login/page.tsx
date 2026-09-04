import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

function Loading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<Loading />}><LoginForm /></Suspense>;
}
