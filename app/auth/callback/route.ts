import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/server-admin'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const next       = searchParams.get('next') ?? '/dashboard'
  const integration = searchParams.get('integration')
  const errorParam = searchParams.get('error')
  const errorDesc  = searchParams.get('error_description')

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorDesc || errorParam)}`, origin)
    )
  }

  const supabase = createSupabaseServerClient()

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (integration === 'google' && data.session?.user) {
        await supabaseAdmin.from('user_integrations').upsert(
          {
            user_id: data.session.user.id,
            provider: 'google',
            access_token: data.session.provider_token || null,
            external_user_id: data.session.user.email || null,
            external_team_id: null,
            external_team_name: null,
            metadata: {
              provider: 'google',
              email: data.session.user.email || null,
              scopes: 'gmail.readonly calendar.readonly',
            },
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider' }
        )
      }

      return NextResponse.redirect(
        new URL(type === 'recovery' ? '/auth/set-password' : next, origin)
      )
    }
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, origin)
    )
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(
        new URL(type === 'recovery' || type === 'invite' ? '/auth/set-password' : next, origin)
      )
    }
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, origin)
    )
  }

  return NextResponse.redirect(new URL('/auth/login', origin))
}
