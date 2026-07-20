export type AdaptiveScenarioType = 'general' | 'contact'
export type AdaptiveChannel = 'text' | 'phone' | 'video'
export type AdaptiveDifficulty = 'realistic' | 'supportive' | 'challenging'
export type AdaptiveSessionStatus = 'active' | 'completed' | 'abandoned'
export type AdaptiveTurnLifecycle = 'setup' | 'ready' | 'responding' | 'paused' | 'help' | 'completed' | 'abandoned'
export type AdaptiveTrajectory = 'opening' | 'uncertain' | 'resistant' | 'disengaging' | 'resolved'

export type AdaptiveSnapshot = {
  scenarioType: AdaptiveScenarioType
  channel: AdaptiveChannel
  difficulty: AdaptiveDifficulty
  contactId?: string | null
  person: string
  situation: string
  goal: string
  concern: string
  relationshipContext: string
  personStyle: string
  constraints: string
  approvedContactContext?: string
}

export type AdaptiveState = {
  goal: string
  concerns: string[]
  constraints: string[]
  knownInformation: string[]
  misunderstandings: string[]
  trust: number
  defensiveness: number
  openness: number
  relationshipDynamic: string
  lastReaction: string
  trajectory: AdaptiveTrajectory
}

export type AdaptiveTranscriptItem = {
  role: 'user' | 'simulated_person'
  content: string
  turn: number
  createdAt: string
  stateAfter?: AdaptiveState
}

export type AdaptiveReplayPoint = {
  turn: number
  why: string
}

export type AdaptiveAssessment = {
  summary: string
  whatWorked: string[]
  turningPoints: Array<AdaptiveTurningPoint | string>
  resistance: { increased: string[]; reduced: string[] }
  goalProgress: string
  replayPoint: AdaptiveReplayPoint | null
  openingLine?: { user: string; person: string } | null
}

export type AdaptiveTurningPoint = {
  turn: number
  userSaid: string
  personSaid: string
  why: string
}

export type AdaptiveNudge = {
  shouldNudge: boolean
  prompt: string
  examples: string[]
}

export type AdaptiveSupervision = {
  state: AdaptiveState
  shouldNudge: boolean
  prompt: string
  examples: string[]
  nextTurnGuidance: string
}

export type AdaptiveReplay = {
  branchTurn: number
  transcript: AdaptiveTranscriptItem[]
  state: AdaptiveState
  originalTrajectory: AdaptiveTrajectory
  replayTrajectory: AdaptiveTrajectory
  originalOutcome: string
  replayOutcome: string
}

export type AdaptiveTurnResult = {
  reply: string
  state: AdaptiveState
  signals: string[]
  conversationStatus: 'ongoing' | 'ending' | 'ended'
  endReason: string | null
}

export type AdaptiveSession = {
  id: string
  userId?: string
  contactId?: string | null
  scenarioType: AdaptiveScenarioType
  channel: AdaptiveChannel
  difficulty: AdaptiveDifficulty
  status: AdaptiveSessionStatus
  lifecycle: AdaptiveTurnLifecycle
  setupSnapshot: AdaptiveSnapshot
  simulationState: AdaptiveState
  transcript: AdaptiveTranscriptItem[]
  assessment: AdaptiveAssessment | null
  replay?: AdaptiveReplay | null
  createdAt?: string
  updatedAt?: string
  completedAt?: string | null
}
