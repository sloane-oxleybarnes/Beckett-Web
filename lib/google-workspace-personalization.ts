import { fetchCoachingProfileContext } from "@/lib/coaching-profile";
import {
  lookupRelationshipContextByEmail,
  type ContactRelationshipContext,
} from "@/lib/contact-relationship-context";
import type { WorkspaceAddOnProfile } from "@/lib/google-workspace-addon";
import {
  gmailPrimaryCounterpartEmail,
  type SelectedGmailThread,
} from "@/lib/google-workspace-gmail";
import { supabaseAdmin } from "@/lib/server-admin";

export type WorkspaceGmailPersonalization = {
  coachingPromptContext: string;
  counterpartEmail: string | null;
  relationshipContext: ContactRelationshipContext | null;
};

export async function loadWorkspaceGmailPersonalization(
  profile: WorkspaceAddOnProfile,
  thread: SelectedGmailThread,
): Promise<WorkspaceGmailPersonalization> {
  const counterpartEmail = gmailPrimaryCounterpartEmail(thread, profile.googleEmail);

  try {
    const [coachingProfile, relationshipContext] = await Promise.all([
      fetchCoachingProfileContext(supabaseAdmin, profile.id, { includeToolkit: true, toolkitLimit: 5 }),
      counterpartEmail
        ? lookupRelationshipContextByEmail({ userId: profile.id, email: counterpartEmail })
        : Promise.resolve(null),
    ]);

    return {
      coachingPromptContext: coachingProfile.promptContext,
      counterpartEmail,
      relationshipContext,
    };
  } catch (error) {
    console.error("Google Workspace Gmail personalization lookup failed", {
      userId: profile.id,
      counterpartEmail,
      message: error instanceof Error ? error.message : "personalization_lookup_failed",
    });
    return { coachingPromptContext: "", counterpartEmail, relationshipContext: null };
  }
}
