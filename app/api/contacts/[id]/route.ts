import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getExtensionUserId } from '@/lib/extension-auth'

async function getAuthedUserId(req: NextRequest): Promise<string | null> {
  const extUserId = await getExtensionUserId(req)
  if (extUserId) return extUserId
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user.id ?? null
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getAuthedUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json() as {
    name?: string
    email?: string
    slack_handle?: string
    phone_number?: string
    notes?: string
    trusted?: boolean
  }

  const supabase = createSupabaseServerClient()

  // Ensure the contact belongs to this user
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single()

  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.email !== undefined) updates.email = body.email?.toLowerCase().trim() || null
  if (body.slack_handle !== undefined) updates.slack_handle = body.slack_handle?.trim() || null
  if (body.phone_number !== undefined) updates.phone_number = body.phone_number?.trim() || null
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null
  if (body.trusted !== undefined) updates.trusted = body.trusted

  const { data: contact, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync contact_identifiers for email/slack
  if (body.email !== undefined) {
    await supabase.from('contact_identifiers').delete().eq('contact_id', params.id).eq('platform', 'email')
    if (body.email) {
      await supabase.from('contact_identifiers').upsert({
        contact_id: params.id,
        user_id: userId,
        platform: 'email',
        identifier: body.email.toLowerCase().trim(),
      }, { onConflict: 'user_id,platform,identifier' })
    }
  }
  if (body.slack_handle !== undefined) {
    await supabase.from('contact_identifiers').delete().eq('contact_id', params.id).eq('platform', 'slack')
    if (body.slack_handle) {
      await supabase.from('contact_identifiers').upsert({
        contact_id: params.id,
        user_id: userId,
        platform: 'slack',
        identifier: body.slack_handle.trim(),
      }, { onConflict: 'user_id,platform,identifier' })
    }
  }

  return NextResponse.json({ contact })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getAuthedUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
