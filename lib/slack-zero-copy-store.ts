import { supabaseAdmin } from "@/lib/server-admin";
import {
  buildSlackFlowSessionRow,
  buildSlackUsageEventRow,
  type SlackDurableInteractionMetadata,
  type SlackZeroCopyFlowStatus,
  type SlackZeroCopyFlowType,
} from "@/lib/slack-zero-copy";

export {
  buildSlackFlowSessionRow,
  buildSlackUsageEventRow,
  normalizeSlackZeroCopyFlowType,
} from "@/lib/slack-zero-copy";

export type SlackZeroCopyFlowSession = {
  id: string;
  beckett_user_id: string | null;
  slack_team_id: string;
  slack_user_id: string;
  slack_channel_id: string | null;
  slack_thread_ts: string | null;
  slack_message_ts: string | null;
  slack_source_channel_id: string | null;
  slack_source_thread_ts: string | null;
  slack_source_message_ts: string | null;
  flow_type: SlackZeroCopyFlowType;
  current_step: string | null;
  status: SlackZeroCopyFlowStatus;
  request_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  archived_at: string | null;
};

export type SlackZeroCopyBotMessage = {
  id: string;
  flow_session_id: string;
  beckett_user_id: string | null;
  slack_channel_id: string;
  slack_message_ts: string;
  kind: string | null;
  created_at: string;
  deleted_at: string | null;
};

export async function createSlackZeroCopyFlowSession(value: SlackDurableInteractionMetadata) {
  const { data, error } = await supabaseAdmin
    .from("slack_flow_sessions")
    .insert(buildSlackFlowSessionRow(value))
    .select("*")
    .single();
  if (error) throw error;
  return data as SlackZeroCopyFlowSession;
}

export async function upsertSlackZeroCopyFlowSession(value: SlackDurableInteractionMetadata) {
  const row = buildSlackFlowSessionRow(value);
  if (!row.slack_thread_ts) return createSlackZeroCopyFlowSession(value);
  if (!row.slack_channel_id) {
    const existing = await findSlackZeroCopyFlowSessionByThreadReference({
      teamId: row.slack_team_id,
      slackUserId: row.slack_user_id,
      threadTs: row.slack_thread_ts,
    });
    if (existing) {
      const updated = await updateSlackZeroCopyFlowSession(existing.id, {
        currentStep: row.current_step,
        flowType: row.flow_type,
        status: row.status,
        expiresAt: row.expires_at,
      });
      if (updated) return updated;
    }
    return createSlackZeroCopyFlowSession(value);
  }
  const { data, error } = await supabaseAdmin
    .from("slack_flow_sessions")
    .upsert(row, { onConflict: "slack_team_id,slack_user_id,slack_channel_id,slack_thread_ts" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SlackZeroCopyFlowSession;
}

export async function findSlackZeroCopyFlowSessionByThreadReference(input: {
  teamId: string;
  slackUserId: string;
  threadTs: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("slack_flow_sessions")
    .select("*")
    .eq("slack_team_id", input.teamId)
    .eq("slack_user_id", input.slackUserId)
    .eq("slack_thread_ts", input.threadTs)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as SlackZeroCopyFlowSession | null;
}

export async function updateSlackZeroCopyFlowSession(
  id: string,
  patch: {
    slackChannelId?: string | null;
    slackThreadTs?: string | null;
    slackMessageTs?: string | null;
    currentStep?: string | null;
    flowType?: SlackZeroCopyFlowType;
    status?: SlackZeroCopyFlowStatus;
    expiresAt?: string | null;
    archivedAt?: string | null;
  }
) {
  const row = {
    ...(patch.slackChannelId !== undefined ? { slack_channel_id: patch.slackChannelId } : {}),
    ...(patch.slackThreadTs !== undefined ? { slack_thread_ts: patch.slackThreadTs } : {}),
    ...(patch.slackMessageTs !== undefined ? { slack_message_ts: patch.slackMessageTs } : {}),
    ...(patch.currentStep !== undefined ? { current_step: patch.currentStep } : {}),
    ...(patch.flowType !== undefined ? { flow_type: patch.flowType } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.expiresAt !== undefined ? { expires_at: patch.expiresAt } : {}),
    ...(patch.archivedAt !== undefined ? { archived_at: patch.archivedAt } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from("slack_flow_sessions")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data || null) as SlackZeroCopyFlowSession | null;
}

export async function findSlackZeroCopyFlowSession(input: {
  teamId: string;
  slackUserId: string;
  channelId: string;
  threadTs: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("slack_flow_sessions")
    .select("*")
    .eq("slack_team_id", input.teamId)
    .eq("slack_user_id", input.slackUserId)
    .eq("slack_channel_id", input.channelId)
    .eq("slack_thread_ts", input.threadTs)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as SlackZeroCopyFlowSession | null;
}

export async function loadSlackZeroCopyFlowSession(id: string, beckettUserId?: string | null) {
  let query = supabaseAdmin.from("slack_flow_sessions").select("*").eq("id", id);
  if (beckettUserId) query = query.eq("beckett_user_id", beckettUserId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data || null) as SlackZeroCopyFlowSession | null;
}

export async function listSlackZeroCopyFlowSessions(beckettUserId: string, limit = 8) {
  const { data, error } = await supabaseAdmin
    .from("slack_flow_sessions")
    .select("*")
    .eq("beckett_user_id", beckettUserId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as SlackZeroCopyFlowSession[];
}

export async function recordSlackZeroCopyUsage(value: SlackDurableInteractionMetadata) {
  const { data, error } = await supabaseAdmin
    .from("slack_usage_events")
    .insert(buildSlackUsageEventRow(value))
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function recordSlackZeroCopyBotMessage(input: {
  flowSessionId: string;
  beckettUserId?: string | null;
  channelId: string;
  messageTs: string;
  kind?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("slack_flow_bot_messages")
    .upsert({
      flow_session_id: input.flowSessionId,
      beckett_user_id: input.beckettUserId || null,
      slack_channel_id: input.channelId,
      slack_message_ts: input.messageTs,
      kind: input.kind || null,
    }, { onConflict: "flow_session_id,slack_channel_id,slack_message_ts" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SlackZeroCopyBotMessage;
}

export async function listSlackZeroCopyBotMessages(flowSessionId: string, beckettUserId?: string | null) {
  let query = supabaseAdmin
    .from("slack_flow_bot_messages")
    .select("*")
    .eq("flow_session_id", flowSessionId)
    .is("deleted_at", null);
  if (beckettUserId) query = query.eq("beckett_user_id", beckettUserId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as SlackZeroCopyBotMessage[];
}

export async function markSlackZeroCopyBotMessageDeleted(id: string) {
  const { error } = await supabaseAdmin
    .from("slack_flow_bot_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
