export function gmailOpenCreatedDraftAction(draftId: string, draftThreadId: string) {
  if (!draftId || !draftThreadId) throw new Error("gmail_draft_response_invalid");

  return {
    hostAppAction: {
      gmailAction: {
        openCreatedDraftActionMarkup: {
          draftId,
          draftThreadId,
        },
      },
    },
  } as const;
}
