# Database workflow

The ordered files in `migrations/` are the canonical Beckett schema. Do not add
or update a hand-maintained schema snapshot; it had drifted from production and
still referenced the pre-Beckett project name.

Create migrations with the Supabase CLI:

```sh
npx supabase@2.113.0 migration new descriptive_name
```

After applying migrations, regenerate and commit `lib/database.types.ts`:

```sh
SUPABASE_PROJECT_ID=your-project-ref npm run db:types
```

The command requires a Supabase CLI access token. Review generated diffs and run
database advisors before deployment, especially for RLS and security-definer
functions.
