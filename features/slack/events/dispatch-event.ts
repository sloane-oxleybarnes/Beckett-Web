import { NextRequest, NextResponse } from 'next/server'
import { extractActiveSlackContext, type SlackEventEnvelope } from '@/features/slack/event-contracts'
import { scheduleSlackBackgroundTask, verifySlackRequest } from '@/lib/slack-app'
import { markSlackInstallationUninstalled } from '@/lib/slack-installation'
import { publishHome, respondToAgentMessage, setupMessagesSurface } from './handle-event'

export async function dispatchSlackEvent(req: NextRequest) {
  const rawBody = await req.text()
  const body = JSON.parse(rawBody || '{}') as SlackEventEnvelope
  if (body.type === 'url_verification' && body.challenge) {
    return new NextResponse(body.challenge, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }
  const verification = verifySlackRequest(req, rawBody)
  if (!verification.ok) return NextResponse.json({ error: verification.message }, { status: verification.status })

  const event = body.event
  if (body.type === 'event_callback' && (event?.type === 'app_uninstalled' || event?.type === 'tokens_revoked')) {
    if (body.team_id) scheduleSlackBackgroundTask('Slack installation revocation failed', markSlackInstallationUninstalled(body.team_id))
    return NextResponse.json({ ok: true })
  }
  if (body.type === 'event_callback' && event?.type === 'app_home_opened' && event.user) {
    if (!event.tab || event.tab === 'home') scheduleSlackBackgroundTask('Slack app home publish failed', publishHome({ teamId: body.team_id || '', slackUserId: event.user }))
    if (!event.tab || event.tab === 'messages') scheduleSlackBackgroundTask('Slack agent surface setup failed', setupMessagesSurface({ teamId: body.team_id || '', slackUserId: event.user, channelId: event.channel }))
    return NextResponse.json({ ok: true })
  }
  if (body.type !== 'event_callback' || event?.type !== 'message' || event.channel_type !== 'im' || !event.user || !event.channel || !event.text || event.bot_id || event.subtype) {
    return NextResponse.json({ ok: true })
  }
  const active = extractActiveSlackContext(event)
  scheduleSlackBackgroundTask('Slack agent message response failed', respondToAgentMessage({
    teamId: body.team_id || '', slackUserId: event.user, channelId: event.channel, threadTs: event.thread_ts || event.ts || '', text: event.text,
    activeChannelId: active.channelId, activeUserId: active.userId, actionToken: active.actionToken, isThreadReply: Boolean(event.thread_ts),
  }))
  return NextResponse.json({ ok: true })
}
