# Microsoft 365 production setup

The production release uses a Microsoft Entra web application dedicated to Beckett production.

## Redirect URI

Register this exact Web redirect URI:

```text
https://www.meetbeckett.co/api/microsoft/oauth/callback
```

## Vercel production environment

Configure these values for the Production environment only:

```text
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
MICROSOFT_TENANT_ID
MICROSOFT_REDIRECT_URI=https://www.meetbeckett.co/api/microsoft/oauth/callback
MICROSOFT_TOKEN_ENCRYPTION_KEY
```

`MICROSOFT_TOKEN_ENCRYPTION_KEY` must be a dedicated random 32-byte key encoded as base64, or a 64-character hexadecimal key. Do not reuse a Google token key.

## Delegated permissions

The production web connection requests only:

- `User.Read`
- `Calendars.ReadBasic`
- `openid`, `profile`, `email`, and `offline_access`

It does not request mail access, calendar writes, draft creation, Teams access, or background change notifications.

## Outlook add-in

Use `docs/outlook-addin-manifest-production.xml` for production validation or distribution. The task pane reads only the item the user selects and sends it to Beckett only after the user chooses **Decode with Beckett**. Inserting coaching into a draft is a separate user action; the add-in never sends mail.

Before deployment, verify:

1. OAuth sign-in and reconnect with both a work account and a personal Microsoft account.
2. Calendar selection and a 14-day maximum event query.
3. Disconnect deletes the local Microsoft integration record.
4. The Outlook task pane can sign in, decode a selected message, and insert text into a draft without sending it.
