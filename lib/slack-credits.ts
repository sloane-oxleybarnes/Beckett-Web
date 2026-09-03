import { slackRepository } from "@/lib/repositories/slack-repository";
import { getWebCreditSummary } from "@/lib/web-credits";

export const SLACK_GUEST_DAILY_CREDITS = 5;
const pendingCredits = new Map<string, { reservationId: string; eventType: string; flowType: string }>();

export class SlackCreditLimitError extends Error {
  status = 429;
  constructor() { super("You have used today's Beckett coaching credits."); }
}

function utcDayStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nextUtcDay() {
  const next = utcDayStart();
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export async function getSlackCreditSummary(input: { teamId: string; slackUserId: string; beckettUserId?: string | null }) {
  if (input.beckettUserId) {
    const summary = await getWebCreditSummary(input.beckettUserId);
    if (summary.enabled) {
      return { linked: true, plan: summary.plan, limit: summary.daily.limit, used: summary.daily.used, remaining: summary.daily.remaining, resetsAt: summary.daily.resetsAt };
    }
    const [{ data: profile, error: profileError }, { data: events, error: eventError }] = await Promise.all([
      slackRepository.from("profiles").select("plan").eq("id", input.beckettUserId).maybeSingle(),
      slackRepository.from("web_credit_events").select("credits").eq("user_id", input.beckettUserId).gte("created_at", utcDayStart().toISOString()),
    ]);
    if (profileError) throw profileError;
    if (eventError) throw eventError;
    const plan = String(profile?.plan || "free");
    const limit = plan === "beta" ? 60 : plan === "pro" || plan === "team" ? 100 : 10;
    const used = (events || []).reduce((total, row) => total + Number(row.credits || 0), 0);
    return { linked: true, plan, limit, used, remaining: Math.max(limit - used, 0), resetsAt: nextUtcDay() };
  }

  const { data, error } = await slackRepository.from("slack_usage_events")
    .select("credits_charged")
    .eq("slack_team_id", input.teamId)
    .eq("slack_user_id", input.slackUserId)
    .eq("success", true)
    .gte("occurred_at", utcDayStart().toISOString());
  if (error) throw error;
  const used = (data || []).reduce((total, row) => total + Number(row.credits_charged || 0), 0);
  return { linked: false, plan: "free", limit: SLACK_GUEST_DAILY_CREDITS, used, remaining: Math.max(SLACK_GUEST_DAILY_CREDITS - used, 0), resetsAt: nextUtcDay() };
}

export async function reserveSlackCredit(input: { requestId: string; teamId: string; slackUserId: string; beckettUserId?: string | null }) {
  const summary = await getSlackCreditSummary(input);
  const { data, error } = await slackRepository.rpc("reserve_slack_credit", {
    p_request_id: input.requestId,
    p_slack_team_id: input.teamId,
    p_slack_user_id: input.slackUserId,
    p_beckett_user_id: input.beckettUserId || null,
    p_allowance_limit: summary.limit,
  });
  if (error) {
    if (error.message?.includes("slack_credit_limit_reached")) throw new SlackCreditLimitError();
    throw error;
  }
  return data as { id: string; status: "reserved" | "committed" | "released" };
}

export async function commitSlackCredit(reservationId: string, eventType: string, flowType: string) {
  const { data, error } = await slackRepository.rpc("commit_slack_credit", { p_reservation_id: reservationId, p_event_type: eventType, p_flow_type: flowType });
  if (error) throw error;
  return data;
}

export async function releaseSlackCredit(reservationId: string) {
  const { error } = await slackRepository.rpc("release_slack_credit", { p_reservation_id: reservationId });
  if (error) throw error;
}

export function registerSlackCreditForResponse(response: string, value: { reservationId: string; eventType: string; flowType: string }) {
  if (response) pendingCredits.set(response, value);
}

function pendingForPayload(payload: unknown) {
  const strings: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach(visit);
  };
  visit(payload);
  for (const [response, pending] of Array.from(pendingCredits.entries())) {
    if (strings.some((value) => value.includes(response))) return { response, pending };
  }
  return null;
}

export async function settleSlackCreditForPayload(payload: unknown, accepted: boolean) {
  const match = pendingForPayload(payload);
  if (!match) return;
  pendingCredits.delete(match.response);
  if (accepted) await commitSlackCredit(match.pending.reservationId, match.pending.eventType, match.pending.flowType);
  else await releaseSlackCredit(match.pending.reservationId);
}
