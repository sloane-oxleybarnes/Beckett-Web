# Microsoft 365 staging connection

The staging web app uses a Microsoft Entra web application named `Beckett M365 Staging`.

## Redirect URI

```text
https://beckett-git-staging-sloane-s-projects1.vercel.app/api/microsoft/oauth/callback
```

Register this exact URI under the app registration's **Authentication → Web → Redirect URIs**.

## Preview/Staging environment variables

Set these only in the Vercel Preview/Staging environment:

```text
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
MICROSOFT_TENANT_ID
MICROSOFT_REDIRECT_URI
```

`MICROSOFT_CLIENT_SECRET` is server-only. Do not use a `NEXT_PUBLIC_` name and do not commit its value.

The first staging flow requests only delegated `User.Read` and `Calendars.ReadBasic` access (plus the standard OIDC scopes and `offline_access`). It is read-only and does not request Outlook mail, Teams, calendar writes, or message posting.

## Staging capabilities

- Calendar events are read through Microsoft Graph `calendarView` after the user selects calendars in Beckett.
- Outlook Mail Decode uses incremental delegated `Mail.Read` consent and only retrieves a message when the user selects it.
- Outlook coaching is provided inside Outlook through the task pane at `/outlook-addin`; the sideload manifest is `docs/outlook-addin-manifest-staging.xml`.
- The old `/dashboard/outlook` web page now hands off to the task pane instead of maintaining a second inbox UI.
- The task pane checks the Beckett session before sending selected message content to the decode endpoint. If Outlook's webview does not share browser cookies, the user can open the staging sign-in link in a new tab and return to the pane.
- The manifest exposes Beckett from both message reading and message composition surfaces. Draft insertion remains user-triggered and Beckett never sends a message.
- Optional calendar blocks require a separate `Calendars.ReadWrite` consent and an explicit confirmation in Beckett.
- Optional server-side draft saving requires a separate `Mail.ReadWrite` consent and an explicit confirmation. Beckett never sends mail.
- Change notifications are opt-in and use `/api/microsoft/webhooks`; notification payloads are treated as invalid until the stored `clientState` matches.

The optional write consents should not be added to the initial Microsoft verification submission. They are only for staging experiments until the read-only experience and its disclosures are complete.

Tokens are encrypted before they are stored in `user_integrations`. The implementation prefers `MICROSOFT_TOKEN_ENCRYPTION_KEY` and falls back to the existing `GOOGLE_TOKEN_ENCRYPTION_KEY` so staging can use the same established AES-256-GCM key-management path.
