import { getDeploymentEnv, isStagingLikeDeployment } from "@/lib/deployment-env";
import StagingBannerClient from "./StagingBannerClient";

export default function StagingBanner() {
  const hidden = process.env.NEXT_PUBLIC_HIDE_STAGING_BANNER === "true";
  const env = getDeploymentEnv();
  const label = isStagingLikeDeployment() ? (env === "preview" ? "Preview" : env) : "";

  return <StagingBannerClient initialLabel={label} hidden={hidden} />;
}
