# CI environment contracts

The public smoke suite runs against a local build and never needs credentials. The authenticated preview workflow is intentionally manual so credentials are never exposed to pull requests or fork builds.

Configure these repository or environment secrets before running `.github/workflows/authenticated-preview.yml`:

- `E2E_EMAIL`: dedicated staging account email with completed beta consent.
- `E2E_PASSWORD`: dedicated staging account password.
- `E2E_FOREIGN_CONTACT_ID`: a contact owned by a second staging account, used by the cross-user ownership check.
- `SUPABASE_PROJECT_ID`: the linked staging project ref for database-type drift checks.
- `SUPABASE_ACCESS_TOKEN`: a read-only Supabase CLI token for generated types.

The database-contracts job always applies migrations to a disposable local Supabase database. Type drift checking skips when the two Supabase secrets are absent (for example, on fork pull requests) and runs automatically when they are configured on the repository or staging environment.
