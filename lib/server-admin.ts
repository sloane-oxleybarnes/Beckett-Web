import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './supabase-env'

// The repo does not have generated Supabase table types yet, so the admin client
// stays intentionally loose while still being lazy-created at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = SupabaseClient<any, 'public', any>

let cachedAdminClient: SupabaseAdminClient | null = null

export function getSupabaseAdmin() {
  cachedAdminClient ||= createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey()
  )
  return cachedAdminClient
}

export const supabaseAdmin = new Proxy({} as SupabaseAdminClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseAdmin(), prop, receiver)
  },
}) as SupabaseAdminClient
