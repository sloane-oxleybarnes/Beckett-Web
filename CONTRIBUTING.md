# Contributing

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
