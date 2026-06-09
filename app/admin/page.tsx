import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import AdminLoginForm from "./LoginForm";
import AdminApprovalList from "./ApprovalList";
import AdminContentEditor from "./ContentEditor";
import AdminBetaTracker, { type BetaTrackerRow } from "./BetaTracker";
import { getSiteContent } from "@/lib/site-content-server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = cookies();
  const isAuthed =
    cookieStore.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;

  if (!isAuthed) {
    return <AdminLoginForm />;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [
    { data: signups },
    { data: profiles },
    { data: integrations },
    { data: aiUsage },
    { data: courseCompletions },
    { data: feedback },
    content,
  ] = await Promise.all([
    supabase
      .from("beta_signups")
      .select("id, email, name, created_at, approved")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, email, full_name, display_name, first_name, plan, created_at, first_login_complete, onboarding_completed_at, extension_connected_at")
      .in("plan", ["beta", "pro"]),
    supabase
      .from("user_integrations")
      .select("user_id, provider, connected_at, updated_at"),
    supabase
      .from("ai_usage_events")
      .select("user_id, action, source, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("course_completions")
      .select("user_id, course_id, completed_at"),
    supabase
      .from("beta_feedback")
      .select("user_id, rating, created_at"),
    getSiteContent(),
  ]);

  const pendingSignups = (signups || []).filter((signup) => !signup.approved);
  const trackerRows = buildBetaTrackerRows({
    signups: signups || [],
    profiles: profiles || [],
    integrations: integrations || [],
    aiUsage: aiUsage || [],
    courseCompletions: courseCompletions || [],
    feedback: feedback || [],
  });

  return (
    <div className="min-h-screen bg-bg p-8">
      <AdminApprovalList signups={pendingSignups} />
      <AdminBetaTracker rows={trackerRows} />
      <AdminContentEditor content={content} />
    </div>
  );
}

type SignupRow = {
  email: string;
  name: string | null;
  created_at: string;
  approved: boolean;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  display_name?: string | null;
  first_name?: string | null;
  created_at: string;
  onboarding_completed_at?: string | null;
  extension_connected_at?: string | null;
};

type IntegrationRow = {
  user_id: string;
  provider: string;
  connected_at?: string | null;
  updated_at?: string | null;
};

type ActivityRow = {
  user_id: string;
  created_at: string;
};

type CourseCompletionRow = {
  user_id: string;
  completed_at?: string | null;
};

type FeedbackRow = ActivityRow & {
  rating: string;
};

function buildBetaTrackerRows({
  signups,
  profiles,
  integrations,
  aiUsage,
  courseCompletions,
  feedback,
}: {
  signups: SignupRow[];
  profiles: ProfileRow[];
  integrations: IntegrationRow[];
  aiUsage: ActivityRow[];
  courseCompletions: CourseCompletionRow[];
  feedback: FeedbackRow[];
}): BetaTrackerRow[] {
  const profileByEmail = new Map(profiles.map((profile) => [profile.email.toLowerCase(), profile]));
  const signupByEmail = new Map(signups.map((signup) => [signup.email.toLowerCase(), signup]));
  const emails = Array.from(new Set([...Array.from(profileByEmail.keys()), ...Array.from(signupByEmail.keys())]));

  return emails.map((email) => {
    const profile = profileByEmail.get(email) || null;
    const signup = signupByEmail.get(email) || null;
    const userId = profile?.id || "";
    const userIntegrations = integrations.filter((item) => item.user_id === userId);
    const google = userIntegrations.find((item) => item.provider === "google");
    const slack = userIntegrations.find((item) => item.provider === "slack");
    const analyses = aiUsage.filter((item) => item.user_id === userId);
    const courses = courseCompletions.filter((item) => item.user_id === userId);
    const feedbackRows = feedback.filter((item) => item.user_id === userId);

    return {
      email: profile?.email || signup?.email || email,
      name: profile?.display_name || profile?.first_name || profile?.full_name || signup?.name || null,
      signedUpAt: signup?.created_at || null,
      approved: Boolean(signup?.approved || profile),
      accountCreatedAt: profile?.created_at || null,
      onboardedAt: profile?.onboarding_completed_at || null,
      extensionConnectedAt: profile?.extension_connected_at || null,
      gmailConnectedAt: google?.connected_at || google?.updated_at || null,
      slackConnectedAt: slack?.connected_at || slack?.updated_at || null,
      analysisCount: analyses.length,
      firstAnalysisAt: analyses[0]?.created_at || null,
      courseCompletions: courses.length,
      feedbackCount: feedbackRows.length,
      negativeFeedbackCount: feedbackRows.filter((item) => item.rating === "no").length,
      lastFeedbackAt: feedbackRows.at(-1)?.created_at || null,
    };
  }).sort((a, b) => {
    const aTime = Date.parse(a.signedUpAt || a.accountCreatedAt || "1970-01-01");
    const bTime = Date.parse(b.signedUpAt || b.accountCreatedAt || "1970-01-01");
    return bTime - aTime;
  });
}
