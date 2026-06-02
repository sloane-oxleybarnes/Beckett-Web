'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const searchParams = new URLSearchParams(window.location.search)

    const access_token = hashParams.get('access_token')
    const refresh_token = hashParams.get('refresh_token')
    // type can be in hash (Supabase default flow) or query params (custom redirectTo)
    const type = hashParams.get('type') || searchParams.get('type')
    const error = hashParams.get('error') || searchParams.get('error')
    const error_description = hashParams.get('error_description') || searchParams.get('error_description')
    const token_hash = searchParams.get('token_hash')
    const code = searchParams.get('code')

    if (error) {
      router.push(`/auth/signin?error=${encodeURIComponent(error_description || error)}`)
      return
    }

    // Flow 1: hash tokens (Supabase default — goes through supabase.co/auth/v1/verify)
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (error) {
          router.push(`/auth/signin?error=${encodeURIComponent(error.message)}`)
          return
        }
        if (type === 'invite' || type === 'recovery') {
          router.push('/auth/set-password')
        } else {
          router.push('/dashboard')
        }
      })
      return
    }

    // Flow 2: token_hash query param (direct link without Supabase verify server)
    if (token_hash && type) {
      supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType }).then(({ error }) => {
        if (error) {
          router.push(`/auth/signin?error=${encodeURIComponent(error.message)}`)
          return
        }
        if (type === 'invite' || type === 'recovery') {
          router.push('/auth/set-password')
        } else {
          router.push('/dashboard')
        }
      })
      return
    }

    // Flow 3: OAuth / PKCE code exchange
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) router.push('/auth/signin?error=invalid_token')
        else router.push('/dashboard')
      })
      return
    }

    router.push('/auth/signin')
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBF8F3', fontFamily: 'DM Sans, sans-serif', color: '#8A8784', fontSize: 15 }}>
      Setting up your account…
    </div>
  )
}
