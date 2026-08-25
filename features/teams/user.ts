import { fetchCoachingProfileContext } from "@/lib/coaching-profile";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";

export async function lookupTeamsBeckettUser(aadObjectId: string) {
  const { data: integration, error } = await integrationsRepository
    .from("user_integrations")
    .select("user_id, external_user_id")
    .eq("provider", "microsoft")
    .eq("external_user_id", aadObjectId)
    .maybeSingle();
  if (error) throw error;
  if (!integration?.user_id) return null;

  const coaching = await fetchCoachingProfileContext(
    integrationsRepository,
    integration.user_id,
    { includeToolkit: true, toolkitLimit: 5 },
  );
  return {
    id: integration.user_id,
    promptContext: coaching.promptContext,
  };
}
