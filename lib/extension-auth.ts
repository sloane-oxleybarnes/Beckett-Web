import { NextRequest } from 'next/server'
import { integrationsRepository } from "@/lib/repositories/integrations-repository"

export async function getExtensionUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  if (!token) return null
  const { data } = await integrationsRepository
    .from('profiles')
    .select('id')
    .eq('extension_token', token)
    .single()
  return data?.id ?? null
}

export async function getExtensionProfile(req: NextRequest): Promise<{ id: string; email: string | null; plan: string | null } | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  if (!token) return null

  const { data } = await integrationsRepository
    .from('profiles')
    .select('id, email, plan')
    .eq('extension_token', token)
    .single()

  return data || null
}
