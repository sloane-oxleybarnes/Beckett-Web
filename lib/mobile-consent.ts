import "server-only";

import { platformRepository } from "@/lib/repositories/platform-repository";

export const MOBILE_AI_CONSENT_VERSION = "2026-10-07" as const;
// Mobile v1 deliberately supports transient processing only. Keep the type and
// API narrow until there is an explicit, tested per-result save workflow.
export const mobileRetentionModes = ["transient"] as const;
export type MobileRetentionMode = (typeof mobileRetentionModes)[number];

export type MobilePrivacyPreferences = {
  aiProcessingAllowed: boolean;
  aiConsentVersion: string | null;
  aiConsentedAt: string | null;
  retentionMode: MobileRetentionMode;
  updatedAt: string | null;
};

export function isMobileRetentionMode(value: unknown): value is MobileRetentionMode {
  return typeof value === "string" && mobileRetentionModes.includes(value as MobileRetentionMode);
}

export function hasCurrentMobileAiConsent(preferences: MobilePrivacyPreferences) {
  return preferences.aiProcessingAllowed && preferences.aiConsentVersion === MOBILE_AI_CONSENT_VERSION;
}

export async function getMobilePrivacyPreferences(userId: string): Promise<MobilePrivacyPreferences> {
  const { data } = await platformRepository
    .from("mobile_privacy_preferences")
    .select("ai_processing_allowed, ai_consent_version, ai_consented_at, retention_mode, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    aiProcessingAllowed: data?.ai_processing_allowed === true,
    aiConsentVersion: typeof data?.ai_consent_version === "string" ? data.ai_consent_version : null,
    aiConsentedAt: typeof data?.ai_consented_at === "string" ? data.ai_consented_at : null,
    retentionMode: "transient",
    updatedAt: typeof data?.updated_at === "string" ? data.updated_at : null,
  };
}

export async function setMobilePrivacyPreferences(
  userId: string,
  input: { aiProcessingAllowed: boolean; retentionMode: MobileRetentionMode },
) {
  const now = new Date().toISOString();
  const { error } = await platformRepository
    .from("mobile_privacy_preferences")
    .upsert({
      user_id: userId,
      ai_processing_allowed: input.aiProcessingAllowed,
      ai_consent_version: input.aiProcessingAllowed ? MOBILE_AI_CONSENT_VERSION : null,
      ai_consented_at: input.aiProcessingAllowed ? now : null,
      retention_mode: input.retentionMode,
      updated_at: now,
    }, { onConflict: "user_id" });
  if (error) throw error;
  return getMobilePrivacyPreferences(userId);
}

export function mobilePrivacyDto(preferences: MobilePrivacyPreferences) {
  return {
    aiProcessing: {
      allowed: preferences.aiProcessingAllowed,
      current: hasCurrentMobileAiConsent(preferences),
      consentVersion: preferences.aiConsentVersion,
      requiredVersion: MOBILE_AI_CONSENT_VERSION,
      consentedAt: preferences.aiConsentedAt,
      disclosure: "When you ask Beckett for coaching, the text or image content you select is sent securely to Beckett and its approved AI processor to create that response. It is not used for advertising or model training.",
    },
    retention: {
      mode: preferences.retentionMode,
      disclosure: "Message content is processed for this request and is not saved to your Beckett history.",
    },
    updatedAt: preferences.updatedAt,
  };
}
