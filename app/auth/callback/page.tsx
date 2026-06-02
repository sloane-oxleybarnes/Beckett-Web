'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthCallbackPage() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function handleAuth() {
      // First check if session already exists
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const hash = window.location.hash
        const params = new URLSearchParams(hash.substring(1))
        const type = params.get('type')

        if (type === 'invite' || type === 'recovery') {
          router.push('/auth/set-password')
        } else {
          router.push('/dashboard')
        }
        return
      }

      // If no session yet, listen for auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          subscription.unsubscribe()
          const hash = window.location.hash
          const params = new URLSearchParams(hash.substring(1))
          const type = params.get('type')

          if (event === 'PASSWORD_RECOVERY' || type === 'recovery' || type === 'invite') {
            router.push('/auth/set-password')
          } else {
            router.push('/dashboard')
          }
        }
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        subscription.unsubscribe()
        router.push('/auth/signin?error=Session+could+not+be+established.+Please+try+again.')
      }, 5000)
    }

    handleAuth()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FBF8F3', fontFamily: 'DM Sans, sans-serif', color: '#8A8784', fontSize: 15 }}>
      Setting up your account…
    </div>
  )
}
