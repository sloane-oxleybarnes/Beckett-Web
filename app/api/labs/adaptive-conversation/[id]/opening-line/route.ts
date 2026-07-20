import { NextResponse } from 'next/server'
import { getAdaptiveAuth } from '@/lib/adaptive-auth'
import { callAdaptiveModel, type AdaptiveSnapshot } from '@/lib/openai-adaptive'

function parseOpeningLine(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const candidate = cleaned.startsWith('{') ? cleaned : cleaned.match(/\{[\s\S]*\}/)?.[0]
  if (!candidate) return ''
  try {
    const parsed = JSON.parse(candidate) as { openingLine?: unknown }
    return typeof parsed.openingLine === 'string' ? parsed.openingLine.trim() : ''
  } catch {
    return ''
  }
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, session, response } = await getAdaptiveAuth()
  if (response || !session) return response

  const { data: row, error } = await supabase
    .from('adaptive_conversation_sessions')
    .select('id, setup_snapshot')
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .single()

  if (error || !row) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })

  const snapshot = row.setup_snapshot as AdaptiveSnapshot
  const instructions = `You are Beckett drafting one opening line for a workplace conversation practice session.

Return only valid JSON with exactly this shape: {"openingLine":"..."}

Write one natural line the user could actually say to the person. Use the approved setup as private context, but do not assume the user's feelings, intent, or preferred solution. Turn the situation and goal into a coherent topic; do not copy a fragment or paste raw setup text. Do not invent facts. Keep it conversational, specific, and concise (8-24 words). Match the relationship and communication style when provided. Avoid corporate filler, coaching language, and generic wording such as “I wanted to touch base.” This is a suggested starting point, not a prediction of the other person's response.`
  const input = JSON.stringify({
    person: snapshot.person,
    situation: snapshot.situation,
    goal: snapshot.goal,
    concern: snapshot.concern,
    relationshipContext: snapshot.relationshipContext,
    personStyle: snapshot.personStyle,
    constraints: snapshot.constraints,
  })

  try {
    const openingLine = parseOpeningLine(await callAdaptiveModel(instructions, input, 180))
    if (!openingLine) throw new Error('The simulator returned an invalid opening line.')
    return NextResponse.json({ openingLine })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'The opening line could not be generated.' }, { status: 502 })
  }
}
