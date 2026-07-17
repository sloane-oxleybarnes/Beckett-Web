import { NextResponse } from 'next/server'
import { getAdaptiveAuth } from '@/lib/adaptive-auth'
import { initialAdaptiveState, callAdaptiveModel, parseAdaptiveTurn, turnInstructions } from '@/lib/openai-adaptive'
import type { AdaptiveReplay, AdaptiveSnapshot, AdaptiveState, AdaptiveTranscriptItem } from '@/lib/adaptive-conversation'

type Body = { turn?: number; message?: string }

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { supabase, session, response } = await getAdaptiveAuth()
  if (response || !session) return response
  const body = await req.json().catch(() => null) as Body | null
  const message = body?.message?.trim() || ''
  if (!message) return NextResponse.json({ error: 'A replay response is required.' }, { status: 400 })

  const { data: row, error } = await supabase
    .from('adaptive_conversation_sessions')
    .select('id, setup_snapshot, simulation_state, transcript, assessment, replay')
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .single()
  if (error || !row) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })

  const snapshot = row.setup_snapshot as AdaptiveSnapshot
  const originalTranscript = (Array.isArray(row.transcript) ? row.transcript : []) as AdaptiveTranscriptItem[]
  const existingReplay = row.replay as AdaptiveReplay | null
  const branchTurn = existingReplay?.branchTurn || Number(body?.turn)
  let transcript = existingReplay?.transcript || []
  let state = existingReplay?.state as AdaptiveState | undefined

  if (!existingReplay) {
    if (!Number.isInteger(branchTurn) || branchTurn < 1) return NextResponse.json({ error: 'Choose a turning point to replay.' }, { status: 400 })
    const pointIndex = originalTranscript.findIndex((item) => item.role === 'user' && item.turn === branchTurn)
    if (pointIndex < 0) return NextResponse.json({ error: 'That replay point is no longer available.' }, { status: 400 })
    transcript = originalTranscript.filter((item) => item.turn < branchTurn)
    const priorReply = [...transcript].reverse().find((item) => item.role === 'simulated_person')
    state = priorReply?.stateAfter || initialAdaptiveState(snapshot)
  }
  if (!state) return NextResponse.json({ error: 'Replay state is unavailable.' }, { status: 400 })
  if (transcript.length >= 40) return NextResponse.json({ error: 'This replay has reached its turn limit.' }, { status: 400 })

  const history = transcript.map((item) => `${item.role === 'user' ? 'User' : snapshot.person}: ${item.content}`).join('\n')
  const input = `${history ? `Conversation so far:\n${history}\n\n` : ''}User's replay response:\n${message}`
  let result
  try {
    result = parseAdaptiveTurn(await callAdaptiveModel(turnInstructions(snapshot, state), input, 700))
  } catch (modelError) {
    const messageText = modelError instanceof Error ? modelError.message : 'The replay could not respond.'
    return NextResponse.json({ error: messageText }, { status: 502 })
  }

  const now = new Date().toISOString()
  const nextTurn = transcript.length ? Math.max(...transcript.map((item) => item.turn)) + 1 : branchTurn
  const nextTranscript: AdaptiveTranscriptItem[] = [
    ...transcript,
    { role: 'user', content: message, turn: nextTurn, createdAt: now },
    { role: 'simulated_person', content: result.reply.trim(), turn: nextTurn, createdAt: now, stateAfter: result.state },
  ]
  const originalState = row.simulation_state as AdaptiveState
  const replay: AdaptiveReplay = {
    branchTurn,
    transcript: nextTranscript,
    state: result.state,
    originalTrajectory: originalState.trajectory,
    replayTrajectory: result.state.trajectory,
    originalOutcome: originalState.lastReaction,
    replayOutcome: result.endReason || result.state.lastReaction,
  }
  const { error: updateError } = await supabase
    .from('adaptive_conversation_sessions')
    .update({ replay, updated_at: now })
    .eq('id', params.id)
    .eq('user_id', session.user.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ replay, reply: result.reply.trim(), conversationStatus: result.conversationStatus, endReason: result.endReason })
}
