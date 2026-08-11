import { fetchSlackThreadSnapshot, type SlackThreadTurn } from "@/lib/slack-app";
import {
  findSlackZeroCopyFlowSession,
  loadSlackZeroCopyFlowSession,
  normalizeSlackZeroCopyFlowType,
  updateSlackZeroCopyFlowSession,
  upsertSlackZeroCopyFlowSession,
  type SlackZeroCopyFlowSession,
} from "@/lib/slack-zero-copy-store";

export type SlackGuestFlowType = "decode" | "respond" | "rewrite" | "prep" | "practice" | "retrieval";

export type SlackGuestSource = {
  channelId?: string;
  channelName?: string;
  messageTs?: string;
  threadTs?: string;
  author?: string;
  message?: string;
  context?: string;
  reactions?: string[];
};

export type SlackGuestSession = {
  id: string;
  slack_team_id: string;
  slack_user_id: string;
  assistant_channel_id: string;
  assistant_thread_ts: string;
  flow_type: SlackGuestFlowType;
  source: SlackGuestSource;
  state: Record<string, unknown>;
  artifacts: Record<string, unknown>;
  transcript: Array<{ role: "user" | "beckett"; content: string }>;
  status: "active" | "completed" | "archived";
  practice_thread_ts?: string | null;
};

function zeroCopyToGuestFlowType(flowType: SlackZeroCopyFlowSession["flow_type"]): SlackGuestFlowType {
  if (flowType === "general" || flowType === "relationship" || flowType === "message") return "retrieval";
  return flowType;
}

function zeroCopyToGuestSession(flow: SlackZeroCopyFlowSession): SlackGuestSession {
  return {
    id: flow.id,
    slack_team_id: flow.slack_team_id,
    slack_user_id: flow.slack_user_id,
    assistant_channel_id: flow.slack_channel_id || "",
    assistant_thread_ts: flow.slack_thread_ts || "",
    flow_type: zeroCopyToGuestFlowType(flow.flow_type),
    source: {},
    state: flow.current_step ? { step: flow.current_step } : {},
    artifacts: {},
    transcript: [],
    status: flow.status === "failed" ? "completed" : flow.status,
    practice_thread_ts: flow.slack_message_ts,
  };
}

function priorSlackThreadTurns(turns: SlackThreadTurn[], latestUserText?: string | null) {
  const prior = [...turns];
  const expected = latestUserText?.replace(/\s+/g, " ").trim();
  if (!expected) return prior;
  for (let index = prior.length - 1; index >= 0; index -= 1) {
    const turn = prior[index];
    if (turn.role === "user" && turn.text.replace(/\s+/g, " ").trim() === expected) {
      prior.splice(index, 1);
      break;
    }
  }
  return prior;
}

function isGuestStarterTurn(text: string) {
  return /^(?:help me |let'?s |i want to )?(?:decode|respond|rewrite|prep|prepare|practice)\b/i.test(text.trim());
}

export async function loadSlackGuestSession(input: {
  teamId: string;
  slackUserId: string;
  channelId: string;
  threadTs: string;
  accessToken?: string | null;
  latestUserText?: string | null;
}) {
  const zeroCopy = await findSlackZeroCopyFlowSession({
    teamId: input.teamId,
    slackUserId: input.slackUserId,
    channelId: input.channelId,
    threadTs: input.threadTs,
  });
  if (zeroCopy && (!zeroCopy.expires_at || zeroCopy.expires_at > new Date().toISOString())) {
    const session = zeroCopyToGuestSession(zeroCopy);
    if (!input.accessToken) return session;
    const snapshot = await fetchSlackThreadSnapshot({
      accessToken: input.accessToken,
      channelId: input.channelId,
      threadTs: input.threadTs,
      currentSlackUserId: input.slackUserId,
    });
    if (snapshot.status !== "available") {
      return {
        ...session,
        state: { ...session.state, rehydrationFailure: snapshot.failureReason || "slack_api_error" },
      };
    }
    const turns = priorSlackThreadTurns(snapshot.turns, input.latestUserText);
    const transcript = turns
      .filter((turn) => turn.role === "user" || turn.role === "beckett")
      .map((turn) => ({ role: turn.role as "user" | "beckett", content: turn.text }))
      .slice(-24);
    const userTurns = turns.filter((turn) => turn.role === "user" && !isGuestStarterTurn(turn.text));
    const latestBeckett = turns.filter((turn) => turn.role === "beckett").at(-1)?.text;
    return {
      ...session,
      source: {
        channelId: zeroCopy.slack_source_channel_id || undefined,
        threadTs: zeroCopy.slack_source_thread_ts || undefined,
        messageTs: zeroCopy.slack_source_message_ts || undefined,
      },
      state: {
        ...session.state,
        ...(zeroCopy.flow_type === "rewrite" && userTurns[0] ? { draft: userTurns[0].text } : {}),
      },
      artifacts: latestBeckett ? { latestResponse: latestBeckett } : {},
      transcript,
    };
  }
  return null;
}

export async function startSlackGuestSession(input: {
  teamId: string;
  slackUserId: string;
  channelId: string;
  threadTs: string;
  flowType: SlackGuestFlowType;
  source?: SlackGuestSource;
  state?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  transcript?: SlackGuestSession["transcript"];
}) {
  const flow = await upsertSlackZeroCopyFlowSession({
    slackTeamId: input.teamId,
    slackUserId: input.slackUserId,
    slackChannelId: input.channelId,
    slackThreadTs: input.threadTs,
    slackSourceChannelId: input.source?.channelId || null,
    slackSourceThreadTs: input.source?.threadTs || null,
    slackSourceMessageTs: input.source?.messageTs || null,
    flowType: normalizeSlackZeroCopyFlowType(input.flowType),
    currentStep: typeof input.state?.step === "string" ? input.state.step : "active",
    status: "active",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  return {
    ...zeroCopyToGuestSession(flow),
    source: input.source || {},
    state: input.state || {},
    artifacts: input.artifacts || {},
    transcript: input.transcript || [],
  };
}

export async function updateSlackGuestSession(
  session: SlackGuestSession,
  patch: Partial<Pick<SlackGuestSession, "flow_type" | "source" | "state" | "artifacts" | "transcript" | "status" | "practice_thread_ts">>
) {
  const zeroCopy = await loadSlackZeroCopyFlowSession(session.id);
  if (zeroCopy) {
    const updated = await updateSlackZeroCopyFlowSession(session.id, {
      ...(patch.flow_type ? { flowType: normalizeSlackZeroCopyFlowType(patch.flow_type) } : {}),
      ...(typeof patch.state?.step === "string" ? { currentStep: patch.state.step } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.practice_thread_ts !== undefined ? { slackMessageTs: patch.practice_thread_ts } : {}),
    });
    if (!updated) throw new Error("Slack zero-copy guest flow was not found.");
    return {
      ...zeroCopyToGuestSession(updated),
      source: patch.source || session.source,
      state: patch.state || session.state,
      artifacts: patch.artifacts || session.artifacts,
      transcript: patch.transcript || session.transcript,
      practice_thread_ts: patch.practice_thread_ts ?? session.practice_thread_ts,
    };
  }
  throw new Error("Slack zero-copy guest flow was not found.");
}

export async function claimSlackGuestPractice(session: SlackGuestSession) {
  const zeroCopy = await loadSlackZeroCopyFlowSession(session.id);
  if (zeroCopy) {
    if (zeroCopy.status !== "active" || zeroCopy.slack_message_ts) return null;
    const updated = await updateSlackZeroCopyFlowSession(session.id, { status: "completed" });
    return updated ? zeroCopyToGuestSession(updated) : null;
  }
  return null;
}

export async function releaseSlackGuestPracticeClaim(session: SlackGuestSession) {
  const zeroCopy = await loadSlackZeroCopyFlowSession(session.id);
  if (zeroCopy) {
    await updateSlackZeroCopyFlowSession(session.id, { status: "active" });
    return;
  }
  return;
}

export function appendGuestTurn(
  transcript: SlackGuestSession["transcript"] | null | undefined,
  role: "user" | "beckett",
  content: string
) {
  return [...(transcript || []), { role, content }].slice(-24);
}

export function formatGuestTranscript(transcript: SlackGuestSession["transcript"] | null | undefined) {
  return (transcript || [])
    .map((turn) => `${turn.role === "beckett" ? "Beckett" : "User"}: ${turn.content}`)
    .join("\n")
    .slice(-6000);
}
