# Slack zero-copy staging deployment

Target origin: `https://beckett-git-staging-sloane-s-projects1.vercel.app`

Staging privacy URL: `https://beckett-git-staging-sloane-s-projects1.vercel.app/slack/privacy`

This runbook deploys and migrates the non-destructive zero-copy release. It does **not** execute the historical-content purge in Phase 10.

## 1. Prepare secrets

Use the `Beckett Staging` Slack app's Basic Information page for the client ID, client secret, and signing secret. Generate two separate application secrets locally:

```sh
openssl rand -base64 32 # SLACK_TOKEN_ENCRYPTION_KEY
openssl rand -base64 32 # SLACK_LINK_SIGNING_SECRET
```

Store the results in the password manager. Never commit or paste them into this repository.

## 2. Deploy the staging OAuth Worker

Authenticate Wrangler, then save the staging Slack app credentials as Worker secrets:

```sh
npx wrangler@latest login
npx wrangler@latest secret put SLACK_CLIENT_ID --config wrangler.slack.jsonc --env staging
npx wrangler@latest secret put SLACK_CLIENT_SECRET --config wrangler.slack.jsonc --env staging
npx wrangler@latest deploy --dry-run --config wrangler.slack.jsonc --env staging
npx wrangler@latest deploy --config wrangler.slack.jsonc --env staging
```

Record the deployed `https://...workers.dev` URL. The Worker environment already restricts browser origins and OAuth redirects to the target staging origin.

## 3. Configure the Vercel staging branch

In the Beckett Vercel project's Preview environment, scope these values to the `staging` Git branch:

| Variable | Value |
|---|---|
| `SLACK_SIGNING_SECRET` | Staging Slack app signing secret |
| `SLACK_LINK_SIGNING_SECRET` | Newly generated link-signing secret |
| `SLACK_TOKEN_ENCRYPTION_KEY` | Newly generated 32-byte base64 encryption key |
| `SLACK_OAUTH_WORKER_URL` | Staging Worker URL from step 2 |
| `SLACK_REDIRECT_ORIGIN` | `https://beckett-git-staging-sloane-s-projects1.vercel.app` |
| `NEXT_PUBLIC_SITE_URL` | `https://beckett-git-staging-sloane-s-projects1.vercel.app` |

Keep the existing Supabase, AI-provider, and application variables in place. Do not reuse production Slack credentials in Preview.

## 4. Preflight and apply the database migrations

Use one operator and the Supabase project already linked to Beckett staging:

```sh
supabase migration list
supabase db push --dry-run
supabase db push
```

The new migrations are:

- `20260810213000_slack_zero_copy_foundation.sql`
- `20260811090000_slack_credit_reservations.sql`

After the push, run Supabase's Security Advisor. Confirm the new tables have RLS enabled, `anon` and `authenticated` cannot mutate them, and only `service_role` can execute the three credit RPCs. Do not run `docs/slack-zero-copy-phase-10-runbook.md`.

## 5. Deploy the web release

Merge the reviewed Slack commit into the `staging` branch and push `staging`. Wait for the Vercel Preview deployment tied to the target origin to become Ready. Verify these endpoints before changing the Slack app:

```sh
curl -I https://beckett-git-staging-sloane-s-projects1.vercel.app/api/slack/install
curl -I https://beckett-git-staging-sloane-s-projects1.vercel.app/api/slack/events
curl -I https://beckett-git-staging-sloane-s-projects1.vercel.app/api/slack/interactions
```

Expected: `/api/slack/install` redirects to Slack OAuth. The signed POST-only endpoints may return `405` to a GET; they must not return `404`.

## 6. Update and reinstall the Slack app

Import `docs/slack-app-manifest-staging.yaml` into the `Beckett Staging` app. Confirm Agents/App Home are enabled, token rotation is on, and every request/redirect URL uses the target staging origin. Reinstall the app into the test workspace so the bot receives exactly:

- `commands`
- `chat:write`
- `assistant:write`
- `im:history`
- `im:write`
- `users:read`

No user scopes or workspace-wide search/history scopes should appear in the consent screen.

## 7. Acceptance and migration checks

Run the Slack-only test plan in `docs/slack-desktop-app.md`, including:

- fresh install without a Beckett login;
- optional account linking after install;
- guest five-credit daily allowance;
- linked-account subscription credit sharing;
- successful response commits one credit, while failed AI/Slack delivery releases it;
- message shortcut and private-thread Decode, Respond, Rewrite, Prep, and Practice;
- App Home continuation and archive after a cold/serverless restart;
- uninstall and token-revocation events;
- database inspection confirming no Slack message, prompt, transcript, response, content-derived title, or summary was persisted.

Keep production unchanged until these checks pass. If the web release fails, roll back the Vercel staging deployment. If the migration fails, stop and inspect the failing statement; do not edit Supabase migration history or run the Phase 10 purge.
