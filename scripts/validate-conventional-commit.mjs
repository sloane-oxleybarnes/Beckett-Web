import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TYPES = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
];

const SUBJECT = new RegExp(
  `^(?:${TYPES.join("|")})(?:\\([a-z0-9][a-z0-9._/-]*\\))?!?: [^\\s].+$`,
);

function validate(message, label = "commit") {
  const subject = message.trim().split(/\r?\n/, 1)[0];
  if (SUBJECT.test(subject)) return;

  console.error(`Invalid Conventional Commit ${label}: ${JSON.stringify(subject)}`);
  console.error("Expected: type(scope): imperative description");
  console.error(`Allowed types: ${TYPES.join(", ")}`);
  process.exitCode = 1;
}

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const messageIndex = args.indexOf("--message");
const rangeIndex = args.indexOf("--range");

if (fileIndex >= 0) {
  validate(readFileSync(args[fileIndex + 1], "utf8"));
} else if (messageIndex >= 0) {
  validate(args[messageIndex + 1] || "");
} else if (rangeIndex >= 0) {
  const range = args[rangeIndex + 1];
  if (!range) throw new Error("--range requires a Git revision range");
  const output = execFileSync("git", ["log", "--format=%H%x00%s", range], {
    encoding: "utf8",
  });
  for (const row of output.trim().split("\n").filter(Boolean)) {
    const [sha, subject] = row.split("\0");
    validate(subject, sha.slice(0, 8));
  }
} else if (process.env.PR_TITLE) {
  validate(process.env.PR_TITLE, "PR title");
} else {
  const subject = execFileSync("git", ["log", "-1", "--format=%s"], {
    encoding: "utf8",
  });
  validate(subject, "HEAD");
}
