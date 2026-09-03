import { NextRequest, NextResponse } from 'next/server'
import { callAnthropic, type AnthropicMessage } from '@/lib/anthropic'
import { AiUsageLimitError } from '@/lib/ai-usage'
import { metering } from '@/lib/metering'
import { withAiMetering } from '@/lib/ai-metering'
import { getExtensionProfile } from '@/lib/extension-auth'
import { trackBetaEvent } from '@/lib/beta-events'
import { beckettBoundaryPrompt } from '@/lib/beckett-boundaries'
import { parseJsonObject } from '@/lib/ai-json'
import {
  WEB_CREDITS_ENABLED,
  WebCreditLimitError,
} from '@/lib/web-credits'

type ExtensionAiAction =
  | 'analyze_message'
  | 'draft_from_scratch'
  | 'ask_about_context'
  | 'meeting_brief'
  | 'meeting_debrief'
  | 'practice_turn'
  | 'practice_debrief'

type ExtensionAiBody = {
  action: ExtensionAiAction
  system?: string | null
  prompt?: string
  messages?: AnthropicMessage[]
  maxTokens?: number
  responseFormat?: 'json' | 'text'
  metadata?: Record<string, unknown>
}

function clampMaxTokens(value?: number) {
  if (!value || !Number.isFinite(value)) return 900
  return Math.max(100, Math.min(Math.floor(value), 1800))
}

export async function POST(req: NextRequest) {
  const profile = await getExtensionProfile(req)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = profile.plan || 'free'
  if (plan !== 'beta' && plan !== 'pro' && plan !== 'team' && !(WEB_CREDITS_ENABLED && plan === 'free')) {
    return NextResponse.json({ error: 'Beta access required.' }, { status: 403 })
  }

  try {
    const body = await req.json() as ExtensionAiBody
    const { action, system = null, prompt, responseFormat = 'text', metadata } = body

    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

    const messages = body.messages?.length
      ? body.messages
      : prompt
        ? [{ role: 'user' as const, content: prompt }]
        : []

    if (!messages.length) return NextResponse.json({ error: 'prompt or messages required' }, { status: 400 })

    const systemWithBoundaries = system
      ? system.includes('Relationship-at-work guidance')
        ? system
        : `${system}\n\n${beckettBoundaryPrompt()}`
      : beckettBoundaryPrompt()
    const text = await withAiMetering({
      userId: profile.id,
      source: 'extension',
      action,
      metadata: { responseFormat, ...metadata },
    }, () => callAnthropic(systemWithBoundaries, messages, clampMaxTokens(body.maxTokens)))
    const cleaned = text.trim()

    const currentUsage = WEB_CREDITS_ENABLED
      ? await metering.web.report(profile.id)
      : await metering.ai.report({ userId: profile.id })

    await trackBetaEvent({
      userId: profile.id,
      email: profile.email,
      eventName: 'analysis_completed',
      source: 'extension',
      metadata: {
        action,
        responseFormat,
        platform: metadata?.platform || null,
        mode: metadata?.mode || null,
      },
    })

    if (responseFormat === 'json') {
      return NextResponse.json({ result: parseJsonObject(cleaned), usage: currentUsage })
    }

    return NextResponse.json({ text: cleaned, usage: currentUsage })
  } catch (error) {
    if (error instanceof WebCreditLimitError) {
      return NextResponse.json({ error: error.message, kind: error.kind }, { status: error.status })
    }
    if (error instanceof AiUsageLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          limit: error.limit,
          remaining: error.remaining,
          unlimitedBypassConfigured: error.unlimitedBypassConfigured,
        },
        { status: error.status }
      )
    }

    const message = error instanceof Error ? error.message : 'AI request failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
