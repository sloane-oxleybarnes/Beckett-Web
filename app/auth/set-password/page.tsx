'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      } else {
        setError('Auth session missing — please click the link in your email again.')
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) return setError('Passwords do not match')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setError(error.message)
    router.push('/dashboard')
  }

  if (!ready) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: error ? 'red' : '#8A8784' }}>
      {error || 'Loading…'}
    </div>
  )

  return (
    <div style={{ maxWidth: 400, margin: '6rem auto', padding: '2rem', fontFamily: 'DM Sans, sans-serif' }}>
      <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '2rem', marginBottom: '0.5rem' }}>Set your password</h1>
      <p style={{ color: '#8A8784', marginBottom: '2rem' }}>Choose a password to access your Beckett account.</p>
      {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <input type="password" placeholder="Password (min 8 characters)" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #ddd', marginBottom: '1rem', fontSize: 14 }} />
        <input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #ddd', marginBottom: '1.5rem', fontSize: 14 }} />
        <button type="submit" style={{ width: '100%', background: '#BA7517', color: '#fff', border: 'none', borderRadius: 100, padding: '0.9rem', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>Set password</button>
      </form>
    </div>
  )
}
