import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function callAnthropic(system: string | null, messages: { role: string; content: string }[], maxTokens: number) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API key not configured.')

  const body: Record<string, unknown> = {
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages,
  }
  if (system) body.system = system

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err?.error?.message || `Anthropic error ${res.status}`)
  }

  const data = await res.json() as { content: { text?: string }[] }
  return data.content.map((b) => b.text || '').join('')
}

function modeInstruction(mode?: string) {
  if (mode === 'professional') return 'This is a professional workplace conversation. Keep your responses formal and focused on outcomes.'
  if (mode === 'personal') return 'This is a personal conversation. Respond as a real person would — grounded, sometimes brief, occasionally distracted or terse. Avoid enthusiasm, over-explaining, or performative warmth. Be natural and human.'
  return ''
}

function lengthInstruction(messageCount: number) {
  if (messageCount <= 2) return 'Keep your response to 2-3 sentences maximum.'
  return 'Keep your response to 1-2 sentences. Be concise and realistic — real conversations don\'t monologue.'
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', session.user.id)
    .single()

  const plan = profile?.plan || 'free'
  if (plan !== 'pro' && plan !== 'beta') {
    return NextResponse.json({ error: 'Practice requires a Pro or Beta plan.' }, { status: 403 })
  }

  const body = await req.json() as {
    action: 'turn' | 'debrief' | 'inline_feedback' | 'suggested_prompts' | 'recommend_format' | 'draft_feedback'
    mode?: 'personal' | 'professional'
    system?: string
    messages?: { role: string; content: string }[]
    messageCount?: number
    personDescription?: string
    situation?: string
    goal?: string
    conversationHistory?: string
    userMessage?: string
    context?: string
    person?: string
    lastAIMessage?: string
  }

  const { action, mode } = body

  if (action === 'turn') {
    const { system, messages, messageCount = 0 } = body
    if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 })
    const modeNote = modeInstruction(mode)
    const lenNote = lengthInstruction(messageCount)
    const instructions = [modeNote, lenNote].filter(Boolean).join(' ')
    const fullSystem = system
      ? (instructions ? `${system}\n\n${instructions}` : system)
      : instructions || null
    const text = await callAnthropic(fullSystem, messages, 300)
    return NextResponse.json({ text: text.trim() })
  }

  if (action === 'inline_feedback') {
    const { userMessage, context } = body
    if (!userMessage) return NextResponse.json({ error: 'userMessage required' }, { status: 400 })
    const toneNote = mode === 'professional'
      ? 'Focus on professional effectiveness.'
      : 'Include emotional and relational observations.'

    const system = `You are a communication coach giving brief, honest in-the-moment feedback. ${toneNote}`
    const user = `Context: ${context || 'a practice conversation'}

The user just said: "${userMessage}"

In one short sentence (max 20 words), note how they came across. Be direct and specific. Return only the sentence — no labels, no preamble.`

    const note = await callAnthropic(system, [{ role: 'user', content: user }], 80)
    return NextResponse.json({ note: note.trim() })
  }

  if (action === 'draft_feedback') {
    const { userMessage, conversationHistory, person, situation, goal } = body
    if (!userMessage) return NextResponse.json({ error: 'userMessage required' }, { status: 400 })
    const toneNote = mode === 'professional' ? 'Focus on professional tone and effectiveness.' : 'Focus on emotional tone and how natural it sounds.'

    const system = `You are a communication coach previewing a message before it is sent. ${toneNote}`
    const user = `The user is practicing a conversation with ${person || 'someone'} about: ${situation || 'a difficult topic'}. Their goal: ${goal || 'not specified'}.

${conversationHistory ? `Conversation so far:\n${conversationHistory}\n\n` : ''}The user is about to send: "${userMessage}"

In one sentence (max 20 words), note how this message would likely land — focus on tone and effectiveness, not grammar. Return only the sentence.`

    const note = await callAnthropic(system, [{ role: 'user', content: user }], 80)
    return NextResponse.json({ note: note.trim() })
  }

  if (action === 'recommend_format') {
    const { person, situation, goal } = body

    const user = `Someone is deciding whether a conversation should happen in person or over text/virtually.

Who they are talking to: ${person || 'someone'}
What the conversation is about: ${situation || 'not specified'}
What they want to achieve: ${goal || 'not specified'}

Analyze whether this conversation would be more effective in person or over text/virtually. Return ONLY valid JSON:
{ "format": "in-person" | "virtual", "reason": "1-2 sentence explanation" }`

    const result = await callAnthropic(
      'You analyze communication scenarios and return JSON recommendations. Return only valid JSON.',
      [{ role: 'user', content: user }],
      120
    )
    try {
      const parsed = JSON.parse(result.trim()) as { format: string; reason: string }
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ format: 'virtual', reason: 'Could not determine a recommendation. Proceeding with virtual.' })
    }
  }

  if (action === 'suggested_prompts') {
    const { person, situation, goal, messageCount, lastAIMessage } = body
    const isOpening = !messageCount || messageCount === 0

    const user = `Someone is practicing a difficult conversation.
Talking to: ${person || 'someone'}
Situation: ${situation || 'not specified'}
Goal: ${goal || 'not specified'}
Mode: ${mode || 'not specified'}
Messages so far: ${messageCount ?? 0}
${lastAIMessage ? `The other person just said: "${lastAIMessage}"` : ''}

Generate ${isOpening ? '3' : '4'} short suggested messages the user could send next.
Rules:
- ${isOpening ? 'These are OPENING lines only — introductory, not mid-conversation' : 'These MUST react to what the other person just said'}
- Each suggestion max 12 words
- Vary the approaches (direct, soft, clarifying)
- Return ONLY valid JSON: { "prompts": ["...", "...", "..."] }`

    const result = await callAnthropic(
      'You generate short conversation suggestions. Return only valid JSON.',
      [{ role: 'user', content: user }],
      150
    )
    try {
      const parsed = JSON.parse(result.trim()) as { prompts: string[] }
      return NextResponse.json({ prompts: parsed.prompts || [] })
    } catch {
      return NextResponse.json({ prompts: [] })
    }
  }

  if (action === 'debrief') {
    const { personDescription, situation, goal, conversationHistory } = body
    if (!conversationHistory) return NextResponse.json({ error: 'conversationHistory required' }, { status: 400 })
    const modeNote = modeInstruction(mode)

    const system = `You are Beckett, giving honest feedback after a practice conversation. ${modeNote} Always respond with valid JSON only — no extra text.`
    const user = `You were just playing the role of ${personDescription} in a practice conversation.
The situation: "${situation}"
The user's goal: "${goal}"

Here is the conversation:
${conversationHistory}

Now break character completely. Return a JSON object with exactly these 4 fields (each 1-2 sentences, honest but constructive):

{
  "other_person_felt": "How the other person likely felt during this conversation",
  "how_you_came_across": "How the user came across overall",
  "what_went_well": "One or two specific things that worked",
  "things_to_work_on": "The main thing to improve next time"
}

Return only valid JSON. No markdown, no extra text.`

    const result = await callAnthropic(system, [{ role: 'user', content: user }], 600)
    try {
      const parsed = JSON.parse(result.trim()) as Record<string, string>
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ error: 'Failed to parse feedback. Please try again.' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
