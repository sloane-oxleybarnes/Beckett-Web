# Microsoft Teams staging deployment

This runbook is for the narrow, user-invoked Teams message-action MVP. It keeps staging isolated from the Outlook Microsoft OAuth application and from production.

## Target origin

Use the existing Beckett staging origin:

```text
https://beckett-git-staging-sloane-s-projects1.vercel.app
```

The Teams bot messaging endpoint is:

```text
https://beckett-git-staging-sloane-s-projects1.vercel.app/api/teams/messages
```

The private coaching dialog is:

```text
https://beckett-git-staging-sloane-s-projects1.vercel.app/teams/action
```

## External Microsoft setup

Create a dedicated staging Teams bot registration. For the first test, use a single Microsoft Entra tenant and enable the Microsoft Teams channel. Do not reuse the Outlook add-in client secret.

Configure the bot's messaging endpoint to the staging URL above. Record the bot application ID, client secret, and tenant ID.

## Vercel Preview environment

Scope these values to the `staging` branch / Preview environment:

| Variable | Value or source |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://beckett-git-staging-sloane-s-projects1.vercel.app` |
| `MICROSOFT_TEAMS_APP_ID` | Teams bot application ID |
| `MICROSOFT_TEAMS_APP_SECRET` | Dedicated Teams bot secret |
| `MICROSOFT_TEAMS_TENANT_ID` | Staging Entra tenant ID |
| `MICROSOFT_TEAMS_ACTION_TOKEN_KEY` | New random 32-byte base64 or 64-character hex key |

Never place the Teams bot secret or action-token key in the repository, manifest, or client bundle. Do not reuse `MICROSOFT_TOKEN_ENCRYPTION_KEY`.

## Deploy and verify

Deploy the exact Teams commit to the `staging` branch and wait for the Vercel Preview deployment to become Ready. Verify the public surfaces before sideloading:

```bash
curl -I https://beckett-git-staging-sloane-s-projects1.vercel.app/teams/action
curl -I https://beckett-git-staging-sloane-s-projects1.vercel.app/api/teams/messages
```

The second request may return `405` or `401` to a `HEAD` request; that still confirms the route is deployed. Do not treat a `200` response to an unauthenticated POST as success.

Build the sideload package with the real bot ID:

```bash
MICROSOFT_TEAMS_APP_ID=<registered-guid> \\
MICROSOFT_TEAMS_VALID_DOMAIN=beckett-git-staging-sloane-s-projects1.vercel.app \\
npm run package:teams
```

The staging hostname is packaged as the manifest `validDomains` entry. Use the production default only when packaging the production app.

Upload `teams-app/beckett-teams.zip` to the test tenant through **Teams → Apps → Manage your apps → Upload a custom app**. Tenant custom-app upload must be enabled by the Teams administrator.

## Test account prerequisite

The tester must connect the same Microsoft account to Beckett under Apps before using the Teams action. The MVP maps the Teams `aadObjectId` to the existing Microsoft integration; it does not request new Graph permissions.

## Stop conditions

Stop the rollout and inspect the deployment if any of these occur:

- The bot endpoint accepts a request without valid Teams credentials.
- The selected message appears in Vercel, Sentry, analytics, or database records.
- The action posts into a channel or chat without a user sending it.
- A user can see another user's private dialog result.
- The Teams account cannot be matched to the connected Beckett Microsoft account.
- The activity tenant does not match `MICROSOFT_TEAMS_TENANT_ID`.
- The action repeatedly exceeds the Teams invoke timeout.

Keep production unchanged until the real-client validation checklist in `docs/teams-message-action-mvp.md` passes.
