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

  const platform = req.nextUrl.searchParams.get('platform')
  const identifier = req.nextUrl.searchParams.get('identifier')

  if (!platform || !identifier) {
    return NextResponse.json({ error: 'platform and identifier required' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('contact_identifiers')
    .select('contact_id, contacts(id, name, trusted)')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('identifier', identifier.toLowerCase())
    .single()

  if (!data) return NextResponse.json({ contact: null })

  const contact = (Array.isArray(data.contacts) ? data.contacts[0] : data.contacts) as { id: string; name: string; trusted: boolean } | null
  return NextResponse.json({ contact })
}
