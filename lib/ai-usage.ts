import { supabaseAdmin } from './server-admin'

const DEFAULT_BETA_DAILY_LIMIT = 30
const DEFAULT_BETA_DAILY_COURSE_LIMIT = 40
const DEFAULT_UNLIMITED_AI_EMAILS = ['hello@meetbeckett.co']
export const UNLIMITED_AI_LIMIT = 999999

export class AiUsageLimitError extends Error {
  status = 429
  remaining = 0

  constructor(
    public limit: number,
    kind: 'analysis' | 'course' = 'analysis',
    public unlimitedBypassConfigured = false
  ) {
    super(
      kind === 'course'
        ? `Daily beta course practice limit reached. You get ${limit} Beckett course coaching calls per day during beta.`
        : `Daily beta AI limit reached. You get ${limit} Beckett analyses per day during beta.`
    )
  }
}

export function getDailyAiLimit() {
  const configured = Number(process.env.BETA_DAILY_AI_LIMIT)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_BETA_DAILY_LIMIT
}

export function getDailyCourseAiLimit() {
  const configured = Number(process.env.BETA_DAILY_COURSE_LIMIT)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_BETA_DAILY_COURSE_LIMIT
}

function getUnlimitedAiEmails() {
  return Array.from(
    new Set([
      ...DEFAULT_UNLIMITED_AI_EMAILS,
      ...(process.env.BETA_UNLIMITED_AI_EMAILS || '').split(','),
    ])
  )
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function hasUnlimitedAiBypassConfigured() {
  return getUnlimitedAiEmails().length > 0
}

export async function isUnlimitedAiUser(userId: string) {
  const allowedEmails = getUnlimitedAiEmails()
  if (!allowedEmails.length) return false

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  const profileEmail = typeof profile?.email === 'string' ? profile.email.toLowerCase() : null
  if (profileEmail && allowedEmails.includes(profileEmail)) return true

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
  const authEmail = authUser.user?.email?.toLowerCase()

  return Boolean(authEmail && allowedEmails.includes(authEmail))
}

function startOfUtcDay() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

export async function getAiUsageToday(userId: string, source?: string) {
  let query = supabaseAdmin
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfUtcDay())

  query = source ? query.eq('source', source) : query.neq('source', 'course')

  const { count, error } = await query

  if (error) throw error
  return count || 0
}

export async function getAiUsageSummary(userId: string, source?: string) {
  const isCourse = source === 'course'
  const limit = isCourse ? getDailyCourseAiLimit() : getDailyAiLimit()
  const [used, unlimited] = await Promise.all([
    getAiUsageToday(userId, source),
    isUnlimitedAiUser(userId),
  ])
  return {
    limit: unlimited ? UNLIMITED_AI_LIMIT : limit,
    used,
    remaining: unlimited ? UNLIMITED_AI_LIMIT : Math.max(limit - used, 0),
    unlimited,
  }
}

export async function recordAiUsage(userId: string, input: {
  source: string
  action: string
  tokenEstimate?: number
  metadata?: Record<string, unknown>
}) {
  const isCourse = input.source === 'course'
  const limit = isCourse ? getDailyCourseAiLimit() : getDailyAiLimit()
  const unlimited = await isUnlimitedAiUser(userId)
  const effectiveLimit = unlimited ? UNLIMITED_AI_LIMIT : limit
  const { data, error } = await supabaseAdmin.rpc('consume_ai_usage', {
    p_user_id: userId,
    p_source: input.source,
    p_action: input.action,
    p_token_estimate: input.tokenEstimate || 1,
    p_metadata: input.metadata || {},
    p_limit: effectiveLimit,
  })

  if (error?.message?.includes('ai_usage_limit_reached')) {
    throw new AiUsageLimitError(limit, isCourse ? 'course' : 'analysis', hasUnlimitedAiBypassConfigured())
  }
  if (error) throw error

  const used = Number(data || 0)

  return {
    limit: effectiveLimit,
    used,
    remaining: unlimited ? UNLIMITED_AI_LIMIT : Math.max(limit - used, 0),
    unlimited,
  }
}
