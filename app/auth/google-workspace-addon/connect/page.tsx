import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import GoogleWorkspaceAddonConnectForm from "@/components/auth/GoogleWorkspaceAddonConnectForm";
import { getWorkspaceAddOnLinkSession } from "@/lib/google-workspace-addon-link";
import { isWorkspaceAddOnLinkToken } from "@/lib/google-workspace-addon-link-token";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Connect Gmail to Beckett",
  robots: { index: false, follow: false },
};

export default async function GoogleWorkspaceAddonConnectPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token || "";
  if (!isWorkspaceAddOnLinkToken(token)) {
    return <ExpiredLink />;
  }

  const session = await getWorkspaceAddOnLinkSession(token);
  if (!session) return <ExpiredLink />;

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    const next = `/auth/google-workspace-addon/connect?token=${encodeURIComponent(token)}`;
    redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="mb-8 block text-center text-2xl text-ink font-serif">Beckett</Link>
        <section className="rounded-card border border-border bg-white p-6 shadow-sm sm:p-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-primary">Gmail add-on</p>
          <h1 className="mb-3 text-2xl text-ink font-serif">Connect your Beckett account</h1>
          <p className="mb-6 text-sm leading-relaxed text-ink-mid">
            Confirm which Beckett profile this verified Google account should use for coaching in Gmail.
          </p>
          <GoogleWorkspaceAddonConnectForm
            token={token}
            googleEmail={session.google_email}
            beckettEmail={user.email}
          />
        </section>
      </div>
    </main>
  );
}

function ExpiredLink() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12">
      <div className="mx-auto w-full max-w-xl rounded-card border border-border bg-white p-8 text-center shadow-sm">
        <h1 className="mb-3 text-2xl text-ink font-serif">Connection link expired</h1>
        <p className="text-sm leading-relaxed text-ink-mid">
          Return to Gmail and reopen Beckett to create a new secure connection link.
        </p>
      </div>
    </main>
  );
}
