import { NextRequest, NextResponse } from 'next/server'
import {
  lookupRelationshipContextByIdentifier,
  recordSafeInteractionSummary,
} from '@/lib/contact-relationship-context'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { callAnthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/server-admin'
import { decryptGoogleAccessToken, encryptGoogleAccessToken } from '@/lib/google-token-security'
import { getGoogleGmailOAuthConfig, parseGoogleGmailCredential, refreshGoogleGmailCredential } from '@/lib/google-gmail-oauth'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const { data: integration } = await supabaseAdmin
    .from('user_integrations')
    .select('id, access_token')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .maybeSingle()
  let credential = parseGoogleGmailCredential(decryptGoogleAccessToken(integration?.access_token))
  const oauthConfig = getGoogleGmailOAuthConfig(req.nextUrl.origin)
  if (!integration || !credential || !oauthConfig) return NextResponse.json({ error: 'google_not_connected' })

  if (credential.expiresAt > 0 && credential.expiresAt <= Date.now() + 60_000) {
    const refreshed = await refreshGoogleGmailCredential(credential, oauthConfig.clientId, oauthConfig.clientSecret)
    if (!refreshed) return NextResponse.json({ error: 'google_not_connected' })
    credential = refreshed
    await supabaseAdmin
      .from('user_integrations')
      .update({ access_token: encryptGoogleAccessToken(JSON.stringify(credential)), updated_at: new Date().toISOString() })
      .eq('id', integration.id)
  }
  const token = credential.accessToken

  // Search Gmail for threads with this contact
  const query = encodeURIComponent(`from:${email} OR to:${email}`)
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({})) as { error?: { status?: string } }
    if (err?.error?.status === 'UNAUTHENTICATED') return NextResponse.json({ error: 'google_not_connected' })
    return NextResponse.json({ error: 'gmail_error' })
  }

  const listData = await listRes.json() as { messages?: { id: string }[] }
  if (!listData.messages?.length) return NextResponse.json({ error: 'no_threads_found' })

  // Fetch snippets from first 8 messages
  const snippets: string[] = []
  await Promise.all(
    listData.messages.slice(0, 8).map(async (m) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!msgRes.ok) return
      const msgData = await msgRes.json() as { snippet?: string }
      if (msgData.snippet) snippets.push(msgData.snippet)
    })
  )

  if (!snippets.length) return NextResponse.json({ error: 'no_threads_found' })

  const summary = await callAnthropic(null, [{
    role: 'user',
    content:
    `Based on these email exchanges with someone, describe their communication style in 2-3 sentences. Focus on tone, directness, and how they prefer to receive information. Be specific and practical.

Email snippets:
${snippets.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Return only the description — no preamble, no labels.`,
  }], 200).then((text) => text.trim())

  const relationshipContext = await lookupRelationshipContextByIdentifier({
    userId: user.id,
    identifier: { platform: 'email', identifier: email, confirmed: true },
  })

  if (relationshipContext) {
    await recordSafeInteractionSummary({
      userId: user.id,
      contactId: relationshipContext.contact.id,
      platform: 'gmail',
      interactionType: 'requested_contact_context',
      summary,
      metadata: {
        source: 'gmail_contact_context',
        contact_email: email.toLowerCase().trim(),
      },
    }).catch((error) => {
      console.error('Gmail contact summary storage failed', error)
    })
  }

  return NextResponse.json({
    summary,
    contact: relationshipContext
      ? { id: relationshipContext.contact.id, name: relationshipContext.contact.name }
      : null,
  })
}
