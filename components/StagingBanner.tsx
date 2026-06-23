import { getDeploymentEnv, isStagingLikeDeployment } from "@/lib/deployment-env";

export default function StagingBanner() {
  if (!isStagingLikeDeployment() || process.env.NEXT_PUBLIC_HIDE_STAGING_BANNER === "true") {
    return null;
  }

  const env = getDeploymentEnv();

  return (
    <div className="sticky top-0 z-[100] border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-900">
      Beckett {env === "preview" ? "Preview" : env} environment - test data only
    </div>
  );
}
