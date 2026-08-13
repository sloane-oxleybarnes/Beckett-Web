import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/server-auth'
import { platformRepository } from "@/lib/repositories/platform-repository"

function isAllowedRedirect(uri: string) {
  try {
    const parsed = new URL(uri)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.chromiumapp.org')
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const redirectUri = req.nextUrl.searchParams.get('redirect_uri')
  if (!redirectUri || !isAllowedRedirect(redirectUri)) {
    return NextResponse.json({ error: 'Invalid extension redirect URI.' }, { status: 400 })
  }

  const { user } = await getAuthenticatedContext()

  if (!user) {
    const login = new URL('/auth/login', req.url)
    login.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(login)
  }

  const { data: profile, error } = await platformRepository
    .from('profiles')
    .select('id, email, full_name, first_name, display_name, plan, extension_token')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
  }

  let token = profile.extension_token as string | null
  if (!token) {
    const { data: updated, error: updateError } = await platformRepository
      .from('profiles')
      .update({ extension_token: crypto.randomUUID(), extension_connected_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('extension_token')
      .single()

    if (updateError || !updated?.extension_token) {
      return NextResponse.json({ error: 'Could not create extension token.' }, { status: 500 })
    }
    token = updated.extension_token
  } else {
    await platformRepository
      .from('profiles')
      .update({ extension_connected_at: new Date().toISOString() })
      .eq('id', user.id)
  }

  const target = new URL(redirectUri)
  target.searchParams.set('token', token as string)
  target.searchParams.set('plan', profile.plan || 'beta')
  if (profile.display_name || profile.first_name || profile.full_name) {
    target.searchParams.set('name', profile.display_name || profile.first_name || profile.full_name)
  }
  if (profile.email) target.searchParams.set('email', profile.email)
  return NextResponse.redirect(target)
}
