# Outlook Microsoft SSO setup

Beckett's Outlook pane uses Microsoft nested app authentication (NAA). It acquires a short-lived Microsoft Graph `User.Read` token in memory and does not store a Beckett or Microsoft refresh token in browser storage.

## One-time Entra configuration

In the existing Beckett Microsoft Entra app registration:

1. Open **Authentication** and add a **Single-page application** platform.
2. Add this redirect URI exactly: `brk-multihub://www.meetbeckett.co`.
3. Under **API permissions**, confirm delegated Microsoft Graph **User.Read** is present. Beckett's connected-account flow separately requests mail read permission when a user opts in to full-thread analysis.
4. Ensure **Supported account types** includes the Microsoft 365 work or school accounts Beckett will support. Use the multitenant plus personal-account setting only if it is required for other Beckett Microsoft features.

No new client secret is required for the task pane. It reads the same public client ID already used by Beckett's server-side Microsoft integration.

## Account limitation

Microsoft does not support NAA when an Outlook add-in is loaded in an Outlook.com or Gmail mailbox. The seamless route therefore requires a Microsoft 365 work or school mailbox. This is a Microsoft host limitation, not a Beckett account setting.
