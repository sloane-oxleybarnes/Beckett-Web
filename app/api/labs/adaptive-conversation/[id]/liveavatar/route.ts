import { NextResponse } from 'next/server'
import { getAdaptiveAuth } from '@/lib/adaptive-auth'

/**
 * Creates a short-lived LiveAvatar sandbox embed for the Labs video prototype.
 * The embed is intentionally isolated from Beckett's primary conversation
 * engine; the existing Realtime/text path remains the fallback.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, session, response } = await getAdaptiveAuth()
  if (response || !session) return response

  const { data: row, error } = await supabase
    .from('adaptive_conversation_sessions')
    .select('id, channel')
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .single()

  if (error || !row) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  if (row.channel !== 'video') return NextResponse.json({ error: 'LiveAvatar is available only for video sessions.' }, { status: 400 })

  const apiKey = process.env.LIVEAVATAR_API_KEY
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID
  const contextId = process.env.LIVEAVATAR_CONTEXT_ID
  if (!apiKey || !avatarId || !contextId) {
    return NextResponse.json({ error: 'LiveAvatar sandbox is not configured for Preview.' }, { status: 503 })
  }

  const liveAvatarResponse = await fetch('https://api.liveavatar.com/v2/embeddings', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar_id: avatarId, context_id: contextId, is_sandbox: true }),
    cache: 'no-store',
  })
  const body = await liveAvatarResponse.json().catch(() => null) as { data?: { url?: string }; message?: string } | null
  if (!liveAvatarResponse.ok || !body?.data?.url) {
    return NextResponse.json({ error: body?.message || 'LiveAvatar sandbox could not be started.' }, { status: 502 })
  }

  return NextResponse.json({ url: body.data.url, sandbox: true })
}
