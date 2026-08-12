# Contributing

## Branch workflow

- `main` is the protected production branch. Start new work from an up-to-date
  `main` and merge through a pull request.
- `staging` is the shared preview baseline. Keep it aligned with the latest
  verified release; do not use it as a long-lived development branch.
- Use short-lived, purpose-specific branches such as `codex/feedback-upload`.
  Delete them after merge; GitHub is configured to do this automatically.
- Pull requests to `main` must pass `conventional-commits` and `verify`, resolve
  review conversations, and use squash or rebase merge.
- Tags under `archive/YYYY-MM-DD/` preserve retired divergent branch tips.
  Treat these tags as read-only recovery points rather than active branches.

### Archive tag retention

- Keep `archive/YYYY-MM-DD/*` safety tags for 90 days from the date embedded in
  the tag name.
- Review archive tags monthly. Before deleting one, confirm that its related
  work is merged, intentionally retired, or preserved by a newer archive tag.
- Delete expired tags in a focused maintenance change using explicit tag names;
  never delete archive tags with an unreviewed wildcard.
- Release, incident, legal-hold, and audit records must use a purpose-specific
  tag prefix and are exempt from this 90-day policy.
- Record archive-tag deletions in the maintenance pull request or operations
  log so the removed recovery points remain auditable.

Before starting work:

```sh
git switch main
git pull --ff-only
git switch -c codex/<short-description>
```

## Commit messages

All new commits and squash-merge pull request titles use Conventional Commits:

```text
type(scope): imperative description
```

Allowed types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
`refactor`, `revert`, `style`, and `test`.

Prefer a focused product or platform scope such as `admin`, `auth`, `beta`,
`contacts`, `courses`, `db`, `deps`, `extension`, `feedback`, `practice`,
`slack`, or `ui`.

Examples:

```text
feat(feedback): accept screenshot attachments
fix(auth): reject unsafe callback redirects
refactor(courses): extract progress persistence
chore(deps): resolve high-severity advisories
```

Use `!` and a `BREAKING CHANGE:` footer when a change requires consumers to
migrate. Do not rewrite commits created before adoption; compliance is measured
from this policy forward.

Run `npm run hooks:install` once after cloning to enable the local commit-message
check. CI validates every pull request title and commit, and GitHub should use
squash merges so the pull request title becomes the commit on `main`.

## Required checks

Before requesting review, run:

```sh
npm run verify
npm run security:audit
```

Keep dependency-security upgrades isolated from feature and refactor changes so
lockfile changes, runtime exposure, and regressions remain easy to review.
