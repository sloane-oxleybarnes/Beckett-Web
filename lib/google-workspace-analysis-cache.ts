import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/server-admin";
import {
  normalizeWorkspaceAnalysisSections,
  type WorkspaceAnalysisSections,
} from "@/lib/google-workspace-analysis-card";
import type { SelectedGmailThread } from "@/lib/google-workspace-gmail";
import { logError } from "@/lib/structured-logger";

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

export function workspaceAnalysisThreadRevision(thread: SelectedGmailThread) {
  return createHash("sha256")
    .update(`${thread.id}:${thread.messages.map((message) => message.id).join(":")}`)
    .digest("hex");
}

export async function loadWorkspaceAnalysisCache({
  userId,
  thread,
}: {
  userId: string;
  thread: SelectedGmailThread;
}) {
  const revision = workspaceAnalysisThreadRevision(thread);
  const { data, error } = await supabaseAdmin
    .from("google_workspace_analysis_cache")
    .select("sections")
    .eq("user_id", userId)
    .eq("thread_id", thread.id)
    .eq("thread_revision", revision)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    logError("google_workspace.cache_read_failed", error, { provider: "gmail", operation: "cache_read" });
    return null;
  }

  return normalizeWorkspaceAnalysisSections(data?.sections);
}

export async function loadWorkspaceAnalysisCacheByThreadId({
  userId,
  threadId,
}: {
  userId: string;
  threadId: string;
}) {
  if (!threadId) return null;

  const { data, error } = await supabaseAdmin
    .from("google_workspace_analysis_cache")
    .select("sections")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    logError("google_workspace.cache_thread_lookup_failed", error, { provider: "gmail", operation: "cache_lookup" });
    return null;
  }

  return normalizeWorkspaceAnalysisSections(data?.sections);
}

export async function loadWorkspaceAnalysisCacheByMessageId({
  userId,
  messageId,
}: {
  userId: string;
  messageId: string;
}) {
  if (!messageId) return null;
  const legacyMessageId = messageId.match(/^msg-f:(\d+)$/);
  const cacheMessageId = legacyMessageId
    ? BigInt(legacyMessageId[1]).toString(16)
    : messageId;

  const { data, error } = await supabaseAdmin
    .from("google_workspace_analysis_cache")
    .select("sections")
    .eq("user_id", userId)
    .contains("message_ids", [cacheMessageId])
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    logError("google_workspace.cache_message_lookup_failed", error, { provider: "gmail", operation: "cache_lookup" });
    return null;
  }

  return normalizeWorkspaceAnalysisSections(data?.sections);
}

export async function storeWorkspaceAnalysisCache({
  userId,
  thread,
  sections,
}: {
  userId: string;
  thread: SelectedGmailThread;
  sections: WorkspaceAnalysisSections;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  const { error } = await supabaseAdmin.from("google_workspace_analysis_cache").upsert(
    {
      user_id: userId,
      thread_id: thread.id,
      thread_revision: workspaceAnalysisThreadRevision(thread),
      message_ids: thread.messages.map((message) => message.id).filter(Boolean),
      sections,
      updated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "user_id,thread_id" },
  );

  if (error) throw error;

  await supabaseAdmin
    .from("google_workspace_analysis_cache")
    .delete()
    .eq("user_id", userId)
    .lt("expires_at", now.toISOString());
}
