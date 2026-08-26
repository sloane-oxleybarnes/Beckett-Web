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
    return "Treat the specific message as something the other person sent to the user, not as the user's own draft. Write exactly three ready-to-send replies addressed to that person, labeled Direct, Warm, and Balanced. Each reply must move the conversation forward by acknowledging, answering, asking a useful question, confirming, or setting a boundary as appropriate. Preserve the user's likely intent and do not claim to send anything. Never copy, quote, summarize, or merely paraphrase the specific message as a reply; a reply must add a response from the user. For example, if the message is 'Can you send me the updated numbers by 3 PM?', replies could confirm the deadline, ask for clarification, or state when the numbers will be ready. Return only those three labeled options—no introduction, closing note, follow-up question, or offer to help with anything else.";
  }
  if (action === "rewrite") {
    return "Rewrite the user's draft three ways labeled Clear, Warmer, and More concise. Preserve its meaning, boundaries, and factual claims. Return only those three labeled rewrites—no introduction, closing note, follow-up question, or offer to help with anything else.";
  }
  return "Suggest practical next steps for the user based on the specific message and context. Do not draft a reply unless the user separately asks for response options. Return only the requested next steps; do not add a closing note, follow-up question, or offer to help with anything else.";
}
