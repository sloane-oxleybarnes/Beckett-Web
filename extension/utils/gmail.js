export async function getGmailToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });
}

export async function getGmailProfile(token) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail profile error ${res.status}`);
  return res.json(); // { emailAddress, messagesTotal, ... }
}

export async function getGmailThread(token, threadId) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail thread error ${res.status}`);
  return res.json();
}

export async function getGmailMessage(token, messageId) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail message error ${res.status}`);
  return res.json();
}

export async function searchGmailMessages(token, query, maxResults = 10) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail search error ${res.status}`);
  const data = await res.json();
  return data.messages || [];
}

export function parseThreadMessages(thread) {
  return (thread.messages || []).map(msg => {
    const headers = msg.payload?.headers || [];
    const get = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    const fromRaw = get('From');
    // Extract email from "Display Name <email>" or plain "email"
    const emailMatch = fromRaw.match(/<([^>]+)>/) || fromRaw.match(/([^\s]+@[^\s]+)/);
    const senderEmail = emailMatch ? emailMatch[1].toLowerCase() : '';
    const senderName = fromRaw.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || fromRaw;
    return {
      sender: senderName || fromRaw,
      senderEmail,
      timestamp: get('Date'),
      body: extractBody(msg.payload),
    };
  });
}

function decodeBase64(data) {
  return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractBody(payload) {
  if (!payload) return '';

  // Leaf node with data
  if (payload.body?.data) {
    const text = decodeBase64(payload.body.data);
    return payload.mimeType === 'text/html' ? stripHtml(text) : text;
  }

  if (payload.parts) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
    // Fall back to text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return stripHtml(decodeBase64(part.body.data));
      }
    }
    // Recurse into nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return '';
}

export function getThreadIdFromUrl() {
  const match = location.hash.match(/[#/]([A-Za-z0-9]+)$/);
  return match ? match[1] : null;
}
