export const messageHelpActions = ["decode", "respond", "rewrite", "prep"] as const;

export type MessageHelpAction = (typeof messageHelpActions)[number];

export function isMessageHelpAction(value: unknown): value is MessageHelpAction {
  return typeof value === "string" && messageHelpActions.includes(value as MessageHelpAction);
}

export function messageHelpTask(action: MessageHelpAction) {
  if (action === "decode") {
    return "Explain what the message clearly says, its plausible tone, what remains ambiguous, and what response may be expected. Separate evidence from interpretation and offer practical next steps.";
  }
  if (action === "respond") {
    return "Write three ready-to-send response options labeled Direct, Warm, and Balanced. Preserve the user's intent and do not claim to send anything.";
  }
  if (action === "rewrite") {
    return "Rewrite the user's draft three ways labeled Clear, Warmer, and More concise. Preserve its meaning, boundaries, and factual claims.";
  }
  return "Help the user prepare for the conversation connected to this message. Include the desired outcome, an opening line, key talking points, likely pushback without presenting it as certain, and a useful follow-up.";
}
