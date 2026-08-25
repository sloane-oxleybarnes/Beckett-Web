export const messageHelpActions = ["decode", "respond", "rewrite", "next_steps"] as const;

export type MessageHelpAction = (typeof messageHelpActions)[number];

export function isMessageHelpAction(value: unknown): value is MessageHelpAction {
  return typeof value === "string" && messageHelpActions.includes(value as MessageHelpAction);
}

export function messageHelpTask(action: MessageHelpAction) {
  if (action === "decode") {
    return "Explain only what the message clearly says, its plausible tone, and what remains ambiguous. Separate evidence from interpretation. Do not draft a reply, recommend next steps, or add actions the user did not request. Return only the requested analysis; do not add a closing note, follow-up question, or offer to help with anything else.";
  }
  if (action === "respond") {
    return "Write exactly three ready-to-send response options labeled Direct, Warm, and Balanced. Preserve the user's intent and do not claim to send anything. Return only those three labeled options—no introduction, closing note, follow-up question, or offer to help with anything else.";
  }
  if (action === "rewrite") {
    return "Rewrite the user's draft three ways labeled Clear, Warmer, and More concise. Preserve its meaning, boundaries, and factual claims. Return only those three labeled rewrites—no introduction, closing note, follow-up question, or offer to help with anything else.";
  }
  return "Suggest practical next steps for the user based on the specific message and context. Do not draft a reply unless the user separately asks for response options. Return only the requested next steps; do not add a closing note, follow-up question, or offer to help with anything else.";
}
