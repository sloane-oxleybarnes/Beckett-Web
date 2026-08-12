import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { hasApprovedBetaAccess } from '@/lib/beta-access'
import AdaptiveConversationSimulator from './AdaptiveConversationSimulator'

export default async function AdaptiveConversationPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle()
  if (!(await hasApprovedBetaAccess({ email: user.email, plan: profile?.plan }))) {
    redirect('/beta?access=approval-required')
  }
  return <AdaptiveConversationSimulator />
}
