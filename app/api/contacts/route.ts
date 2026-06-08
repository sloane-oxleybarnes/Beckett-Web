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

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('contacts')
    .select('*, contact_identifiers(*), contact_insights(*)')
    .eq('user_id', userId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data })
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json() as {
    name: string
    email?: string
    slack_handle?: string
    phone_number?: string
    notes?: string
    trusted?: boolean
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      user_id: userId,
      name: body.name.trim(),
      email: body.email?.toLowerCase().trim() || null,
      slack_handle: body.slack_handle?.trim() || null,
      phone_number: body.phone_number?.trim() || null,
      notes: body.notes?.trim() || null,
      trusted: body.trusted ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert contact_identifiers for email and slack_handle
  const identifiers = []
  if (body.email) {
    identifiers.push({ contact_id: contact.id, user_id: userId, platform: 'email', identifier: body.email.toLowerCase().trim() })
  }
  if (body.slack_handle) {
    identifiers.push({ contact_id: contact.id, user_id: userId, platform: 'slack', identifier: body.slack_handle.trim() })
  }
  if (identifiers.length > 0) {
    await supabase.from('contact_identifiers').insert(identifiers)
  }

  return NextResponse.json({ contact }, { status: 201 })
}
