"use client";

import { useMemo, useState } from "react";

export type AdminFeedbackRow = {
  id: string;
  user_id: string;
  rating: string;
  comment: string | null;
  platform: string | null;
  mode: string | null;
  source: string | null;
  thread_count: number | null;
  sender: string | null;
  sender_email: string | null;
  response_text: string | null;
  analysis_result: Record<string, unknown> | null;
  context_snapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type FeedbackWithUser = AdminFeedbackRow & {
  userEmail: string | null;
  userName: string | null;
};

type FeedbackFilter = "all" | "needs_work" | "course" | "extension";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function asPrettyJson(value: unknown) {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) return "";
  return JSON.stringify(value, null, 2);
}

export default function AdminFeedbackViewer({
  feedback,
  profiles,
}: {
  feedback: AdminFeedbackRow[];
  profiles: Array<{ id: string; email: string; full_name?: string | null; display_name?: string | null; first_name?: string | null }>;
}) {
  const [filter, setFilter] = useState<FeedbackFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const rows = useMemo<FeedbackWithUser[]>(() => {
    return feedback.map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        ...row,
        userEmail: profile?.email || null,
        userName: profile?.display_name || profile?.first_name || profile?.full_name || null,
      };
    });
  }, [feedback, profileById]);

  const filteredRows = rows.filter((row) => {
    if (filter === "needs_work") return row.rating === "no";
    if (filter === "course") return row.source === "course" || row.platform === "courses";
    if (filter === "extension") return row.source !== "course" && row.platform !== "courses";
    return true;
  });

  const counts = {
    all: rows.length,
    needs_work: rows.filter((row) => row.rating === "no").length,
    course: rows.filter((row) => row.source === "course" || row.platform === "courses").length,
    extension: rows.filter((row) => row.source !== "course" && row.platform !== "courses").length,
  };

  return (
    <section className="mt-10 max-w-6xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Feedback viewer</h2>
          <p className="text-sm text-ink-mid">
            Review beta feedback from courses and extension analyses, including debug context when available.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: `All (${counts.all})` },
            { id: "needs_work", label: `Needs work (${counts.needs_work})` },
            { id: "course", label: `Courses (${counts.course})` },
            { id: "extension", label: `Extension (${counts.extension})` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id as FeedbackFilter)}
              className={`rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === item.id
                  ? "border-primary bg-primary-light text-primary"
                  : "border-border bg-white text-ink-mid hover:border-primary hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-white">
        {filteredRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-mid">No feedback matches this filter yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {filteredRows.map((row) => {
              const open = openId === row.id;
              const jsonBlocks = [
                { label: "Metadata", value: asPrettyJson(row.metadata) },
                { label: "Context snapshot", value: asPrettyJson(row.context_snapshot) },
                { label: "Analysis result", value: asPrettyJson(row.analysis_result) },
              ].filter((block) => block.value);

              return (
                <article key={row.id} className="p-5">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : row.id)}
                    className="w-full text-left"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-pill px-2.5 py-1 text-xs font-medium ${
                              row.rating === "yes" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {row.rating === "yes" ? "Useful" : "Needs work"}
                          </span>
                          <span className="rounded-pill bg-bg px-2.5 py-1 text-xs font-medium text-ink-light">
                            {row.source || row.platform || "unknown"}
                          </span>
                          {row.platform && (
                            <span className="rounded-pill bg-bg px-2.5 py-1 text-xs font-medium text-ink-light">
                              {row.platform}
                            </span>
                          )}
                          {row.mode && (
                            <span className="rounded-pill bg-bg px-2.5 py-1 text-xs font-medium text-ink-light">
                              {row.mode}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-ink">{row.userName || row.userEmail || row.user_id}</p>
                        {row.userName && <p className="text-xs text-ink-light">{row.userEmail}</p>}
                      </div>
                      <div className="shrink-0 text-xs text-ink-light md:text-right">
                        <p>{formatDate(row.created_at)}</p>
                        {row.thread_count ? <p>{row.thread_count} messages</p> : null}
                      </div>
                    </div>
                    {row.comment && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-mid">{row.comment}</p>}
                  </button>

                  {open && (
                    <div className="mt-5 space-y-4 border-t border-border pt-5">
                      {(row.sender || row.sender_email) && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-light">Sender</p>
                          <p className="mt-1 text-sm text-ink">
                            {[row.sender, row.sender_email].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      )}

                      {row.response_text && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-light">Beckett response</p>
                          <p className="mt-1 whitespace-pre-wrap rounded-sm bg-bg p-3 text-sm leading-relaxed text-ink-mid">
                            {row.response_text}
                          </p>
                        </div>
                      )}

                      {jsonBlocks.map((block) => (
                        <details key={block.label} className="rounded-sm border border-border bg-bg">
                          <summary className="cursor-pointer px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-light">
                            {block.label}
                          </summary>
                          <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-border px-3 py-3 text-xs leading-relaxed text-ink-mid">
                            {block.value}
                          </pre>
                        </details>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
