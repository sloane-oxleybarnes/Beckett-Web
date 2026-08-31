import { NextRequest } from "next/server";
import { trackBetaEvent } from "@/lib/beta-events";
import { recordSafeInteractionSummary } from "@/lib/contact-relationship-context";
import {
  cardUpdateResponse,
  errorCard,
  resolveWorkspaceAddOnProfile,
  signInCard,
  workspaceAddOnRoute,
} from "@/lib/google-workspace-addon";
import { buildWorkspaceAnalysisCard } from "@/lib/google-workspace-analysis-card";
import { loadWorkspaceAnalysisCache } from "@/lib/google-workspace-analysis-cache";
import {
  getSelectedGmailThread,
  gmailCounterparts,
  gmailInteractionDedupeKey,
} from "@/lib/google-workspace-gmail";
import { contactsRepository } from "@/lib/repositories/server-repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findOrCreateContact(userId: string, email: string, name: string) {
  const { data: identifier } = await contactsRepository
    .from("contact_identifiers")
    .select("contact_id")
    .eq("user_id", userId)
    .in("platform", ["email", "work_email", "personal_email"])
    .eq("identifier", email)
    .limit(1)
    .maybeSingle();

  let contactId = identifier?.contact_id || null;
  let created = false;

  if (!contactId) {
    const { data: emailMatch } = await contactsRepository
      .from("contacts")
      .select("id")
      .eq("user_id", userId)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    contactId = emailMatch?.id || null;
  }

  if (!contactId) {
    const { data: contact, error } = await contactsRepository
      .from("contacts")
      .insert({ user_id: userId, name: name.slice(0, 120), email, trusted: false })
      .select("id")
      .single();
    if (error || !contact) throw error || new Error("contact_create_failed");
    contactId = contact.id;
    created = true;
  }

  const now = new Date().toISOString();
  const { error: identifierError } = await contactsRepository.from("contact_identifiers").upsert(
    {
      user_id: userId,
      contact_id: contactId,
      platform: "email",
      identifier: email,
      label: "Gmail",
      confirmed: true,
      updated_at: now,
    },
    { onConflict: "user_id,platform,identifier" },
  );
  if (identifierError) throw identifierError;

  return { contactId, created };
}

export async function POST(request: NextRequest) {
  return workspaceAddOnRoute(request, async (event, diagnostics) => {
    const profile = await resolveWorkspaceAddOnProfile(event, diagnostics);
    if (!profile) return cardUpdateResponse(await signInCard(request, event));

    try {
      const thread = await getSelectedGmailThread(event);
      const requestedEmail = event.commonEventObject?.parameters?.email?.trim().toLowerCase() || "";
      const counterpart = gmailCounterparts(thread, profile.googleEmail)
        .find((candidate) => candidate.email === requestedEmail);
      if (!counterpart) {
        return cardUpdateResponse(errorCard("Contact unavailable", "Choose a participant from the current Gmail conversation."));
      }

      const sections = await loadWorkspaceAnalysisCache({ userId: profile.id, thread });
      if (!sections) {
        return cardUpdateResponse(errorCard("Analyze first", "Analyze this conversation before saving it to Beckett Contacts."));
      }

      const { contactId, created } = await findOrCreateContact(
        profile.id,
        counterpart.email,
        counterpart.name,
      );
      const latest = thread.messages[thread.messages.length - 1];
      await recordSafeInteractionSummary({
        userId: profile.id,
        contactId,
        platform: "gmail",
        interactionType: "selected_thread_analysis",
        summary: sections.happening.slice(0, 2_000),
        toneObserved: sections.tone.slice(0, 1_000) || null,
        suggestedFollowup: sections.want.slice(0, 1_000) || null,
        dedupeKey: gmailInteractionDedupeKey(thread),
        metadata: {
          source: "google_workspace_addon",
          gmail_thread_id: thread.id,
          selected_message_id: thread.selectedMessageId,
          message_count: thread.messages.length,
          counterpart_email: counterpart.email,
          subject: latest?.subject || "(no subject)",
          provenance: "selected_gmail_conversation",
          derived_at: new Date().toISOString(),
          contact_created_from_analysis: created,
        },
      });

      await trackBetaEvent({
        userId: profile.id,
        email: profile.email,
        eventName: created ? "gmail_contact_created" : "gmail_contact_enriched",
        source: "google_workspace_addon",
        metadata: { platform: "gmail", contactId, participantCount: gmailCounterparts(thread, profile.googleEmail).length },
      });

      const action = created ? "was added to" : "was matched with";
      return cardUpdateResponse(buildWorkspaceAnalysisCard(request, sections, {
        message: `${counterpart.name} ${action} Beckett Contacts. A compact summary of this selected conversation was saved with its source and date.`,
      }));
    } catch (error) {
      console.error("Google Workspace Gmail contact enrichment failed", {
        userId: profile.id,
        message: error instanceof Error ? error.message : "contact_enrichment_failed",
      });
      return cardUpdateResponse(errorCard("Contact not saved", "Beckett could not update Contacts. Your Gmail conversation was not changed."));
    }
  });
}
