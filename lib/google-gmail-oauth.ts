import "server-only";

export const GOOGLE_GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export type GoogleGmailCredential = {
  version: 1;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export function getGoogleGmailOAuthConfig(origin: string) {
  // Gmail and Calendar use the same verified production web client. Keeping the
  // credentials server-side lets users connect a Google account without changing
  // their Beckett/Supabase session.
  const clientId = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}/api/gmail/oauth/callback`,
  };
}

export function parseGoogleGmailCredential(value: string | null | undefined) {
  if (!value) return null;

  // Existing Supabase-provider connections stored only an access token. They
  // remain usable until expiry and are replaced with a refreshable credential on
  // the user's next reconnect.
  if (!value.trim().startsWith("{")) {
    return { version: 1, accessToken: value, refreshToken: "", expiresAt: 0 } satisfies GoogleGmailCredential;
  }

  try {
    const parsed = JSON.parse(value) as Partial<GoogleGmailCredential>;
    if (
      parsed.version !== 1 ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return parsed as GoogleGmailCredential;
  } catch {
    return null;
  }
}

export async function refreshGoogleGmailCredential(
  credential: GoogleGmailCredential,
  clientId: string,
  clientSecret: string
) {
  if (!credential.refreshToken) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credential.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token || typeof payload.expires_in !== "number") return null;

  return {
    ...credential,
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  } satisfies GoogleGmailCredential;
}
