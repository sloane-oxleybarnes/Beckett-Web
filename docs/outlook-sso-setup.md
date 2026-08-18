# Outlook authentication and Microsoft permission setup

Beckett prefers Microsoft nested app authentication (NAA) in the Outlook task
pane. It acquires a short-lived Microsoft Graph `User.Read` access token and
keeps it in memory. When NAA is unavailable, Beckett opens its normal sign-in
inside the Office Dialog API and returns only the current short-lived Supabase
access token to the pane. Neither path stores a refresh token in browser
`localStorage` or `sessionStorage`.

## Production Entra configuration

In the production Beckett app registration:

1. Under **Authentication**, add a **Single-page application** redirect URI of
   `brk-multihub://www.meetbeckett.co` for NAA.
2. Add the **Web** redirect URI
   `https://www.meetbeckett.co/api/microsoft/oauth/callback` for connected
   Microsoft features and incremental mail consent.
3. Set **Supported account types** to accounts in any organizational directory
   and personal Microsoft accounts. The NAA route may still be unavailable in
   some mailbox/host combinations; Beckett's Office dialog is the fallback.
4. Confirm delegated Microsoft Graph `User.Read` is configured.
5. Keep `Mail.Read` delegated and user-consented. Beckett requests it only when
   the user chooses **Analyze full thread**.
6. Do not configure `Mail.Send`, application mail permissions, or
   `ReadWriteMailbox` for this add-in.

NAA is a public-client flow and does not use a client secret. Beckett's separate
server-side Microsoft OAuth flow uses `MICROSOFT_CLIENT_SECRET` and
`MICROSOFT_TOKEN_ENCRYPTION_KEY` only on the server.

## Production Supabase configuration

In **Authentication → URL Configuration**:

1. Set **Site URL** to `https://www.meetbeckett.co`.
2. Permit `https://www.meetbeckett.co/auth/callback` in **Redirect URLs**.
3. Keep preview or localhost patterns separate from the production entries.

## Runtime flow

1. The task pane checks for NAA `1.1` and silently requests `User.Read`.
2. If interaction is required, the user can complete the Microsoft popup.
3. If NAA is unsupported or fails, **Sign in to Beckett** opens an Office dialog
   and returns a short-lived Beckett access token to the task pane.
4. **Analyze message** uses Outlook's current-item API and the manifest's
   `ReadWriteItem` permission.
5. **Analyze full thread** requests delegated `Mail.Read` incrementally. On
   desktop Outlook, Beckett polls the authenticated link/consent attempt so the
   system browser and Outlook webview do not need to share cookies.
6. Stored Microsoft OAuth credentials are encrypted with AES-256-GCM. Selected
   message bodies are not stored by default.

## Verification

Run `npm run verify:outlook`, then test NAA, fallback sign-in, and incremental
Mail.Read consent in Outlook web, Windows, and Mac using the production Entra
and Supabase projects.
