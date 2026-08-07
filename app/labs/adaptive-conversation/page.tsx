import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AdaptiveConversationSimulator from './AdaptiveConversationSimulator'

export default async function AdaptiveConversationPage() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')
  return <AdaptiveConversationSimulator />
}
