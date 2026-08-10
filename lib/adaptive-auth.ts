import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function getAdaptiveAuth() {
  if (process.env.GPT56_SIMULATOR_ENABLED === 'false') {
    return {
      supabase: createSupabaseServerClient(),
      session: null,
      response: NextResponse.json({ error: 'The Adaptive Conversation Simulator is not enabled.' }, { status: 404 }),
    }
  }
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { supabase, session: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  return { supabase, session, response: null }
}
