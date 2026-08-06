# Beckett Google Workspace add-on

This is the native Gmail replacement for the Gmail portion of the Beckett Chrome extension. Phase 1 is intentionally button-first: Beckett receives Gmail content only after the user clicks **Analyze selected conversation**.

## Implemented endpoints

- `POST /api/google-workspace-addon/home` — add-on homepage and Beckett account status.
- `POST /api/google-workspace-addon/message` — contextual card shown for an open Gmail message.
- `POST /api/google-workspace-addon/analyze` — user-invoked Gmail retrieval and Beckett analysis.
- `POST /api/google-workspace-addon/reply` — user-invoked reply coaching with two editable wording options; it does not create or send a Gmail draft.

Every endpoint verifies Google's service-account ID token. User identity comes from Google's verified user ID token and is mapped to an existing Beckett profile by Google subject or verified email. The add-on does not use browser cookies or the stored broad `gmail.readonly` integration token.

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
4. Copy `google-workspace-addon-manifest.template.json`, replace `YOUR_DEPLOYMENT_HOST` with the stable deployment hostname, and paste the result into the deployment manifest.
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

## Next phase

After the read/analyze flow passes the test deployment:

1. Add a compose trigger using `gmail.addons.current.action.compose`.
2. Return Google's draft-update response to insert the selected reply wording at the cursor, without sending it.
3. Move any Gmail-specific preferences still stored in `chrome.storage.local` into the Beckett profile.
4. Prepare the Marketplace listing, reviewer test account, privacy disclosures, and verification video.
