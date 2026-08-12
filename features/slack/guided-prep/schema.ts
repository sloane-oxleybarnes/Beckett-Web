export type GuidedFlowType = 'respond' | 'rewrite' | 'decode' | 'prep' | 'practice'
export type SlackDraftOption = { id: 'direct' | 'warm' | 'concise'; label: string; text: string }
export type PrepScenario = 'pto' | 'raise' | 'workload' | 'clarity' | 'feedback' | 'checkin' | 'client' | 'general'
export type GuidedStep = 'ask_audience' | 'ask_person' | 'ask_location' | 'ask_outcome' | 'ask_concern' | 'confirm_evidence' | 'ask_rewrite_draft' | 'ask_respond_message' | 'ask_respond_context' | 'ask_opening_draft' | 'ask_practice_goal' | 'ask_practice_pushback' | 'decode_followup'
export type GuidedAnswers = {
  initial_request?: string; person?: string; person_slack_user_id?: string; person_self_mention?: boolean
  conversation_type?: string; conversation_location?: 'written' | 'call' | 'in_person'; scenario?: PrepScenario
  source_channel_id?: string; source_channel_name?: string; source_thread_ts?: string; audience?: string
  outcome?: string; concern?: string; practice_goal?: string; practice_pushback?: string; extra_context?: string[]
  draft_options?: SlackDraftOption[]
}
export type EvidenceSuggestion = { id: number; text: string; source?: string }
export type SlackAgentSession = {
  id: string; user_id: string; slack_team_id: string; slack_user_id: string; slack_channel_id: string
  thread_ts: string | null; flow_type: GuidedFlowType; step: GuidedStep; status: 'active' | 'completed'
  rehydration_failure?: string | null; answers: GuidedAnswers; evidence_suggestions: EvidenceSuggestion[]
  confirmed_evidence: EvidenceSuggestion[]; coaching_thread_id?: string | null; zero_copy_flow_session_id?: string | null
}
