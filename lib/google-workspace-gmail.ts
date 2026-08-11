import type { WorkspaceAddOnEvent } from "@/lib/google-workspace-addon";
import { createHash } from "node:crypto";

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  payload?: GmailPart;
};
type GmailThread = { id?: string; messages?: GmailMessage[] };
type GmailDraft = { id?: string; message?: GmailMessage };

export type SelectedGmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  date: string;
  messageIdHeader: string;
  references: string;
  body: string;
};

export type SelectedGmailThread = {
  id: string;
  messages: SelectedGmailMessage[];
  selectedMessageId: string;
};

export type GmailCounterpart = {
  email: string;
  name: string;
};

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractBody(part?: GmailPart): string {
  if (!part) return "";
  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);
    return part.mimeType === "text/html" ? stripHtml(decoded) : decoded.trim();
  }
  for (const child of part.parts || []) {
    if (child.mimeType === "text/plain" && child.body?.data) return decodeBase64Url(child.body.data).trim();
  }
  for (const child of part.parts || []) {
    if (child.mimeType === "text/html" && child.body?.data) return stripHtml(decodeBase64Url(child.body.data));
  }
  for (const child of part.parts || []) {
    const nested = extractBody(child);
    if (nested) return nested;
  }
  return "";
}

function header(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function emailFromAddress(value: string) {
  return (value.match(/<([^>]+)>/) || value.match(/([^\s<>]+@[^\s<>]+)/))?.[1]?.toLowerCase() || "";
}

function emailsFromAddressList(value: string) {
  return Array.from(value.matchAll(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)).map((match) =>
    match[1].toLowerCase(),
  );
}

function displayNameFromAddress(value: string, email: string) {
  const beforeAddress = value.includes("<") ? value.slice(0, value.indexOf("<")) : "";
  const cleaned = beforeAddress.trim().replace(/^['"]|['"]$/g, "").slice(0, 120);
  return cleaned || email;
}

function namedAddresses(value: string) {
  const entries = value.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
  return entries.flatMap((entry) => {
    const email = emailFromAddress(entry);
    return email ? [{ email, name: displayNameFromAddress(entry, email) }] : [];
  });
}

export function gmailCounterparts(thread: SelectedGmailThread, userEmail?: string | null) {
  const currentUser = userEmail?.trim().toLowerCase() || "";
  const counterparts = new Map<string, GmailCounterpart>();

  for (const message of thread.messages) {
    for (const participant of [
      ...(message.fromEmail ? [{ email: message.fromEmail, name: displayNameFromAddress(message.from, message.fromEmail) }] : []),
      ...namedAddresses(message.to),
    ]) {
      if (!participant.email || participant.email === currentUser) continue;
      const existing = counterparts.get(participant.email);
      if (!existing || existing.name === existing.email) counterparts.set(participant.email, participant);
    }
  }

  return Array.from(counterparts.values());
}

export function gmailParticipantEmails(thread: SelectedGmailThread, userEmail?: string | null) {
  return gmailCounterparts(thread, userEmail).map((counterpart) => counterpart.email);
}

export function gmailPrimaryCounterpartEmail(thread: SelectedGmailThread, userEmail?: string | null) {
  const currentUser = userEmail?.trim().toLowerCase() || "";
  const latestOtherSender = [...thread.messages]
    .reverse()
    .find((message) => message.fromEmail && message.fromEmail !== currentUser)?.fromEmail;
  return latestOtherSender || gmailParticipantEmails(thread, currentUser)[0] || null;
}

export function gmailInteractionDedupeKey(thread: SelectedGmailThread) {
  const visibleMessageIds = thread.messages.map((message) => message.id).filter(Boolean).join(":");
  return createHash("sha256")
    .update(`${thread.id}:${thread.selectedMessageId}:${visibleMessageIds}`)
    .digest("hex");
}

function normalizeMessage(message: GmailMessage): SelectedGmailMessage {
  const headers = message.payload?.headers;
  const from = header(headers, "From");
  return {
    id: message.id || "",
    threadId: message.threadId || "",
    subject: header(headers, "Subject") || "(no subject)",
    from,
    fromEmail: emailFromAddress(from),
    to: header(headers, "To"),
    date: header(headers, "Date"),
    messageIdHeader: header(headers, "Message-ID") || header(headers, "Message-Id"),
    references: header(headers, "References"),
    body: (extractBody(message.payload) || message.snippet || "").slice(0, 18_000),
  };
}

async function gmailFetch<T>(event: WorkspaceAddOnEvent, path: string): Promise<T> {
  const userToken = event.authorizationEventObject?.userOAuthToken;
  const messageToken = event.gmail?.accessToken;
  if (!userToken || !messageToken) throw new Error("gmail_authorization_missing");
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: {
      Authorization: `Bearer ${userToken}`,
      "X-Goog-Gmail-Access-Token": messageToken,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`gmail_api_error:${response.status}`);
  return response.json() as Promise<T>;
}

function safeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createGmailReplyDraft(
  event: WorkspaceAddOnEvent,
  thread: SelectedGmailThread,
  userEmail: string | null,
  replyText: string,
) {
  const userToken = event.authorizationEventObject?.userOAuthToken;
  const messageToken = event.gmail?.accessToken;
  if (!userToken || !messageToken) throw new Error("gmail_authorization_missing");

  const currentUser = userEmail?.trim().toLowerCase() || "";
  const latest = thread.messages[thread.messages.length - 1];
  const latestSentByUser = Boolean(currentUser && latest?.fromEmail === currentUser);
  const latestNonUserRecipient = latestSentByUser
    ? emailsFromAddressList(latest?.to || "").find((email) => email !== currentUser) || ""
    : "";
  const recipient =
    [...thread.messages].reverse().find((message) => message.fromEmail && message.fromEmail !== currentUser)?.from ||
    latestNonUserRecipient ||
    latest?.from ||
    "";
  if (!recipient) throw new Error("gmail_reply_recipient_missing");

  const subject = latest?.subject || "(no subject)";
  const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
  const referenceValues = [latest?.references, latest?.messageIdHeader].filter(Boolean).join(" ");
  const mimeLines = [
    `To: ${safeHeaderValue(recipient)}`,
    `Subject: ${safeHeaderValue(replySubject)}`,
    ...(latest?.messageIdHeader ? [`In-Reply-To: ${safeHeaderValue(latest.messageIdHeader)}`] : []),
    ...(referenceValues ? [`References: ${safeHeaderValue(referenceValues)}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    replyText.trim(),
  ];

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "X-Goog-Gmail-Access-Token": messageToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        threadId: thread.id,
        raw: encodeBase64Url(mimeLines.join("\r\n")),
      },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`gmail_draft_api_error:${response.status}`);

  const draft = (await response.json()) as GmailDraft;
  const draftId = draft.id || "";
  const draftThreadId = draft.message?.threadId || thread.id;
  if (!draftId || !draftThreadId) throw new Error("gmail_draft_response_invalid");
  return { draftId, draftThreadId };
}

export async function getSelectedGmailThread(event: WorkspaceAddOnEvent): Promise<SelectedGmailThread> {
  const messageId = event.gmail?.messageId || "";
  const threadId = event.gmail?.threadId || "";
  if (!messageId) throw new Error("gmail_message_missing");

  if (threadId) {
    try {
      const thread = await gmailFetch<GmailThread>(event, `threads/${encodeURIComponent(threadId)}?format=full`);
      const messages = (thread.messages || []).map(normalizeMessage).filter((message) => message.body);
      if (messages.length) return { id: thread.id || threadId, messages, selectedMessageId: messageId };
    } catch (error) {
      if (error instanceof Error && !error.message.endsWith(":403")) throw error;
    }
  }

  const message = await gmailFetch<GmailMessage>(event, `messages/${encodeURIComponent(messageId)}?format=full`);
  const normalized = normalizeMessage(message);
  return { id: normalized.threadId || threadId, messages: [normalized], selectedMessageId: messageId };
}

export function threadForPrompt(thread: SelectedGmailThread, userEmail?: string | null) {
  const currentUser = userEmail?.trim().toLowerCase() || "";
  return thread.messages
    .map((message, index) => {
      const date = message.date ? ` — ${message.date}` : "";
      const sender = currentUser && message.fromEmail === currentUser ? "You" : message.from || "Unknown";
      return `Message ${index + 1} from ${sender}${date}:\n${message.body}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 45_000);
}
