import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function DELETE(request: NextRequest) {
  const cookieStore = cookies()
  if (cookieStore.get('admin_auth')?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, signupId } = await request.json()

  if (!signupId) {
    return NextResponse.json({ error: 'signupId required' }, { status: 400 })
  }

  // Delete auth user if they have one (approved users)
  if (userId) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Remove from beta_signups
  await supabaseAdmin.from('beta_signups').delete().eq('id', signupId)

  return NextResponse.json({ success: true })
}
