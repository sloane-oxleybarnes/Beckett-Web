import type { AdaptiveAssessment, AdaptiveSnapshot, AdaptiveTranscriptItem } from '@/lib/adaptive-conversation'

export type AdaptiveContact = { id: string; name: string; notes: string | null; relationship_type: string | null; relationship_other: string | null }
export type AdaptiveSetup = Omit<AdaptiveSnapshot, 'contactId'> & { scenarioType: 'general' | 'contact'; contactId: string }
export type AdaptiveMessage = AdaptiveTranscriptItem
export type AdaptiveSessionAssessment = AdaptiveAssessment
export type SavedAdaptiveSession = { id: string; setup_snapshot: AdaptiveSetup; transcript: AdaptiveMessage[]; assessment: AdaptiveSessionAssessment | null; status: string; updated_at: string }

export const blankAdaptiveSetup: AdaptiveSetup = {
  scenarioType: 'general', channel: 'text', difficulty: 'realistic', contactId: '', person: '', situation: '', goal: '', concern: '',
  relationshipContext: '', personStyle: '', constraints: '', approvedContactContext: '', voicePreference: 'gender_neutral',
}
