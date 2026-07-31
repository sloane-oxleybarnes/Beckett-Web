import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Keep this synchronous for the production Next 14 runtime. Callers may still
// await the returned client, which keeps the same source compatible with the
// staging Next 15 branch without changing auth behavior.
export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: Record<string, unknown>) { cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]) },
        remove(name: string, options: Record<string, unknown>) { cookieStore.set(name, '', options as Parameters<typeof cookieStore.set>[2]) },
      },
    }
  )
}
