# Beckett Google Workspace add-on

This is the native Gmail replacement for the Gmail portion of the Beckett Chrome extension. Phase 1 is intentionally button-first: Beckett receives Gmail content only after the user clicks **Analyze selected conversation**.

## Implemented endpoints

- `POST /api/google-workspace-addon/home` — add-on homepage and Beckett account status.
- `POST /api/google-workspace-addon/message` — contextual card shown for an open Gmail message.
- `POST /api/google-workspace-addon/analyze` — user-invoked Gmail retrieval and Beckett analysis.
- `POST /api/google-workspace-addon/reply` — user-invoked reply coaching with three editable approaches and optional refinement instructions.
- `POST /api/google-workspace-addon/draft` — creates an editable Gmail draft after the user chooses a reply; it never sends the draft.
- `POST /api/google-workspace-addon/style-memory` — changes the user's explicit email-style learning preference.
- `POST /api/google-workspace-addon/connect` — explicitly links a verified Google identity to the signed-in Beckett account using a one-time connection token.

Google-triggered endpoints verify Google's service-account ID token. User identity comes from Google's verified user ID token and is mapped to an existing Beckett profile by Google subject or verified email. If the emails differ, the user can explicitly link the accounts through a 15-minute, one-time connection URL. The Gmail add-on does not use browser cookies or the stored broad `gmail.readonly` integration token to read a selected message.

## Required environment variables

```text
GOOGLE_WORKSPACE_ADDON_CLIENT_ID=OAuth client ID shown for the HTTP deployment
GOOGLE_WORKSPACE_ADDON_SERVICE_ACCOUNT_EMAIL=service account email shown for the HTTP deployment
GOOGLE_WORKSPACE_ADDON_ORIGIN=https://your-stable-deployment.example.com
```

`GOOGLE_WORKSPACE_ADDON_ORIGIN` must exactly match the origin used in every manifest endpoint. It is also used as the expected ID-token audience.

## Create a test deployment

1. Create a separate Google Cloud project for development/testing.
2. Enable the Google Workspace Marketplace SDK.
3. Open **Google Workspace Marketplace SDK → HTTP Deployments** and create a deployment.
4. Use `google-workspace-addon/deployment.staging.json` for Beckett's stable staging hostname, or copy `google-workspace-addon-manifest.template.json` for another isolated test project.
5. Copy the deployment's OAuth client ID and service-account email into the deployment environment variables above.
6. Install the unpublished deployment from the HTTP Deployments page.
7. Reload Gmail, open a message, open Beckett from the right sidebar, authorize the listed scopes, and click **Analyze selected conversation**.

Use a deployment with a stable hostname. Preview URLs that change on every deploy will fail ID-token audience validation.

The manifest also declares Beckett's toolbar and button colors, the fixed-footer widget, and universal menu links for Beckett, settings, privacy, and help. Those settings live in the Google HTTP deployment and must be updated there when the manifest changes.

## Scope test

The initial manifest uses the non-sensitive `gmail.addons.current.message.action` scope. The analysis endpoint attempts to read the selected thread and falls back to the selected message when Google returns `403` for thread access.

During the unpublished test, verify all of the following:

- The selected message body is available after the button click.
- Expanded and collapsed messages in the selected thread are available.
- Switching messages while Beckett remains open updates the contextual card.
- Personal Gmail and managed Google Workspace accounts behave consistently.
- Gmail mobile can run the contextual analysis card.

If full-thread access is not available with the action scope, replace it in the manifest with:

```text
https://www.googleapis.com/auth/gmail.addons.current.message.readonly
```

That is a sensitive scope, but it remains substantially narrower than the restricted `gmail.readonly` scope and does not require the restricted-scope annual security assessment.

## Publication preparation

Use `docs/google-workspace-marketplace-launch.md` for the production gates, OAuth configuration, reviewer journey, Marketplace assets, and rollback plan. Use `docs/google-workspace-marketplace-listing.md` for listing copy and scope justifications.
