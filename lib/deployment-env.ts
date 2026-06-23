export function getDeploymentEnv() {
  return (
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.APP_ENV ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development"
  ).toLowerCase();
}

export function isStagingLikeDeployment() {
  const env = getDeploymentEnv();
  return (
    env === "staging" ||
    env === "preview" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV !== "production"
  );
}

export function canSendLifecycleMessages() {
  return !isStagingLikeDeployment() || process.env.ENABLE_STAGING_EMAILS === "true";
}

export function lifecycleMessagesDisabledReason() {
  return (
    `Lifecycle messages are disabled in ${getDeploymentEnv()} by default. ` +
    "Set ENABLE_STAGING_EMAILS=true only when you intentionally want this environment to send external beta emails or Loops events."
  );
}
