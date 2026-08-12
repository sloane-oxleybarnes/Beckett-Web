import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { hasApprovedBetaAccess } from '@/lib/beta-access'

export async function getAdaptiveAuth() {
  const supabase = await createSupabaseServerClient()
  if (process.env.GPT56_SIMULATOR_ENABLED === 'false') {
    return {
      supabase,
      session: null,
      response: NextResponse.json({ error: 'The Adaptive Conversation Simulator is not enabled.' }, { status: 404 }),
    }
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, session: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const session = { user }

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', session.user.id)
    .maybeSingle()
  const approved = await hasApprovedBetaAccess({ email: session.user.email, plan: profile?.plan })
  if (!approved) return { supabase, session: null, response: NextResponse.json({ error: 'Beta access required.' }, { status: 403 }) }
  return { supabase, session, response: null }
}
