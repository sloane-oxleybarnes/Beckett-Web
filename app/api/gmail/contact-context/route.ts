import { NextResponse } from 'next/server'

// Contact-wide mailbox search is intentionally disabled. The verified Gmail
// workflow is user-invoked Decode for a specific thread; this route must not
// search a mailbox by address or send derived snippets to an AI provider.
export async function GET() {
  return NextResponse.json(
    { error: 'Contact-wide Gmail context is not available. Select a specific thread in Gmail Decode.' },
    { status: 410 },
  )
}
