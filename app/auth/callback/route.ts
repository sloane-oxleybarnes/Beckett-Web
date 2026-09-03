import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { safeInternalPath } from '@/lib/auth-next'

function createCallbackClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          response.cookies.set(name, value, options as never)
        },
        remove(name: string, options: Record<string, unknown>) {
          response.cookies.set(name, '', options as never)
        },
      },
    }
  )
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const requestedNext = searchParams.get('next')
  // PKCE recovery links return only a code, not type=recovery. The explicit
  // password-setup destination is therefore also part of the password action.
  // Do not apply normal beta-login gating before a user can reset their password.
  const isPasswordAction =
    type === 'recovery' || type === 'invite' || requestedNext === '/auth/set-password'
  // Reject protocol-relative and otherwise external redirect targets.
  const next = safeInternalPath(requestedNext) ?? (isPasswordAction ? '/auth/set-password' : '/dashboard')
  const errorParam = searchParams.get('error')
  const errorDesc  = searchParams.get('error_description')

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorDesc || errorParam)}`, origin)
    )
  }

  // OAuth code exchange writes refreshed session cookies. A route handler must
  // attach those cookies to the response it returns; mutating the request cookie
  // store alone leaves the following dashboard request unauthenticated.
  const successResponse = NextResponse.redirect(
    new URL(isPasswordAction ? '/auth/set-password' : next, origin)
  )
  const supabase = createCallbackClient(request, successResponse)

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return successResponse
    }
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, origin)
    )
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      // verifyOtp writes the authenticated session to successResponse. Returning a
      // fresh redirect here drops those cookies, which makes invite recipients look
      // signed out on the password-setup page and sends them back to login.
      return successResponse
    }
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, origin)
    )
  }

  return NextResponse.redirect(new URL('/auth/login', origin))
}
