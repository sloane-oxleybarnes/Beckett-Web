# CI environment contracts

The public smoke suite runs against a local build and never needs credentials. The authenticated preview workflow is intentionally manual so credentials are never exposed to pull requests or fork builds.

Configure these repository or environment secrets before running `.github/workflows/authenticated-preview.yml`:

- `E2E_EMAIL`: dedicated staging account email with completed beta consent.
- `E2E_PASSWORD`: dedicated staging account password.
- `E2E_FOREIGN_CONTACT_ID`: a contact owned by a second staging account, used by the cross-user ownership check.
- `SUPABASE_PROJECT_ID`: the linked staging project ref for database-type drift checks.
- `SUPABASE_ACCESS_TOKEN`: a read-only Supabase CLI token for generated types.
- `SUPABASE_DISPOSABLE_DB_URL`: a disposable staging database connection string. When present, CI executes every migration against it with `supabase db push --include-all`; rotate or recreate this database between runs as appropriate.

The database-contracts job executes migrations against `SUPABASE_DISPOSABLE_DB_URL` when configured. Until that dedicated disposable database is provisioned, CI runs the structural migration validator instead of claiming a clean-from-zero replay (the repository’s historical migrations depend on an older baseline schema). Type drift checking skips when the two Supabase type secrets are absent and runs automatically when configured.
