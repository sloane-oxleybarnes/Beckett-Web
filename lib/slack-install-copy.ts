export const slackInstallScopes = [
  {
    scope: "commands",
    label: "Receive /beckett commands",
    detail: "Starts coaching only when someone invokes Beckett.",
  },
  {
    scope: "chat:write",
    label: "Post Beckett's replies",
    detail: "Lets Beckett reply with coaching and manage only messages Beckett created.",
  },
  {
    scope: "assistant:write",
    label: "Run Beckett's Slack assistant",
    detail: "Updates the private Beckett thread, status, title, and suggested prompts.",
  },
  {
    scope: "im:history",
    label: "Continue the exact Beckett DM thread",
    detail: "Re-reads the private Beckett thread from Slack when you continue it; Beckett does not copy the transcript into its database.",
  },
  {
    scope: "im:write",
    label: "Open a private Beckett conversation",
    detail: "Creates or opens the direct conversation between you and Beckett.",
  },
  {
    scope: "users:read",
    label: "Recognize the person asking",
    detail: "Uses Slack identity for routing and display without storing Slack profile content.",
  },
] as const;

export const slackUnapprovedWarning =
  "Slack will show “App is not approved by Slack” while Beckett completes its public beta and Marketplace eligibility testing. This means Slack has not completed its Marketplace review; it does not mean the installation is blocked. Review the permissions below and continue only if you are comfortable installing the beta app.";
