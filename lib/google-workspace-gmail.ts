import type { WorkspaceAddOnEvent } from "@/lib/google-workspace-addon";

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

export function threadForPrompt(thread: SelectedGmailThread) {
  return thread.messages
    .map((message, index) => {
      const date = message.date ? ` — ${message.date}` : "";
      return `Message ${index + 1} from ${message.from || "Unknown"}${date}:\n${message.body}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 45_000);
}
