import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function sourceFiles(path) {
  const root = new URL(`../${path}`, import.meta.url);
  return readdirSync(root, { recursive: true })
    .filter((entry) => /\.(?:ts|tsx)$/.test(entry))
    .map((entry) => new URL(entry, root))
    .filter((entry) => statSync(entry).isFile());
}

test("Conventional Commit validator accepts policy and rejects legacy subjects", () => {
  const valid = spawnSync(process.execPath, [
    "scripts/validate-conventional-commit.mjs",
    "--message",
    "refactor(auth): consolidate server guards",
  ]);
  const invalid = spawnSync(process.execPath, [
    "scripts/validate-conventional-commit.mjs",
    "--message",
    "Update auth stuff",
  ]);
  assert.equal(valid.status, 0);
  assert.equal(invalid.status, 1);
});

test("web and legacy AI metering use serialized database functions", () => {
  const migration = read("supabase/migrations/20260811220822_atomic_web_ai_credits.sql");
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /create or replace function public\.consume_ai_usage/);
  assert.match(migration, /create or replace function public\.reserve_web_credit/);
  assert.match(migration, /create or replace function public\.commit_web_credit/);
  assert.match(migration, /revoke all on function public\.reserve_web_credit[\s\S]*authenticated/);
});

test("legacy skills redirect and Practice uses the consolidated simulator and contacts", () => {
  assert.match(read("app/dashboard/skills/[id]/page.tsx"), /permanentRedirect/);
  assert.match(read("supabase/migrations/20260811220702_consolidate_contacts.sql"), /drop table public\.trusted_people/);
  assert.match(read("app/dashboard/practice/page.tsx"), /AdaptiveConversationSimulator/);
  assert.doesNotMatch(read("app/api/labs/adaptive-conversation/route.ts"), /from\(['"]trusted_people['"]\)/);
});

test("course content is loaded on the server rather than bundled as client fallback data", () => {
  assert.match(read("app/dashboard/courses/[id]/page.tsx"), /getPublishedCourse/);
  assert.doesNotMatch(read("components/courses/CourseClient.tsx"), /getCourse/);
});

test("Tailwind scans feature modules that render product interfaces", () => {
  assert.match(read("tailwind.config.ts"), /\.\/features\/\*\*\/\*\.\{js,ts,jsx,tsx,mdx\}/);
});

test("the auth proxy only runs for protected dashboard routes", () => {
  assert.match(read("proxy.ts"), /matcher: \['\/dashboard\/:path\*'\]/);
  assert.match(read("proxy.ts"), /auth\.getClaims\(\)/);
});

test("server boundaries use verified users and expose no generic CRM mutation proxies", () => {
  const serverSource = sourceFiles("app/api/").map((file) => readFileSync(file, "utf8")).join("\n");
  const routeSource = sourceFiles("app/")
    .filter((file) => file.pathname.endsWith("/route.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  assert.doesNotMatch(serverSource, /auth\.getSession\(/);
  assert.doesNotMatch(routeSource, /from ["'][^"']*server-admin["']/);
  assert.match(read("lib/repositories/server-repositories.ts"), /contactsRepository/);
  assert.match(read("lib/repositories/server-repositories.ts"), /integrationsRepository/);
  assert.match(read("lib/repositories/server-repositories.ts"), /learningRepository/);
  assert.match(read("lib/repositories/server-repositories.ts"), /slackRepository/);
  assert.match(read("lib/repositories/server-repositories.ts"), /workdayRepository/);
  assert.equal(existsSync(new URL("../app/api/loops/route.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/api/hubspot/route.ts", import.meta.url)), false);
});

test("release migrations include private feedback, indexed Microsoft subscriptions, and foreign-key indexes", () => {
  assert.match(read("supabase/migrations/20260812002201_feedback_screenshots.sql"), /public, file_size_limit[\s\S]*false/);
  assert.match(read("supabase/migrations/20260812002212_microsoft_subscriptions.sql"), /enable row level security/);
  assert.match(read("supabase/migrations/20260812002409_index_foreign_keys.sql"), /contacts_user_id_idx/);
});

test("Practice history is capped at seven conversations", () => {
  assert.match(
    read("app/api/labs/adaptive-conversation/route.ts"),
    /from\(['"]adaptive_conversation_sessions['"]\)[\s\S]*?order\(['"]updated_at['"],[\s\S]*?limit\(7\)/,
  );

  const retentionMigration = read("supabase/migrations/20260817171110_limit_adaptive_conversation_history.sql");
  assert.match(retentionMigration, /history_position > 7/);
  assert.match(retentionMigration, /offset 7/);
  assert.match(retentionMigration, /after insert on public\.adaptive_conversation_sessions/);
});

test("dashboard cards keep secondary content compact until editing", () => {
  const skills = read("app/dashboard/skills/page.tsx");
  assert.doesNotMatch(skills, /From learning to real life/);
  assert.doesNotMatch(skills, /ask-someone-out/);

  assert.match(read("features/contacts/ContactsClient.tsx"), /lg:grid-cols-4/);

  const settings = read("components/dashboard/SettingsPanel.tsx");
  assert.match(settings, /coachingSettingsEditing/);
  assert.match(settings, /aria-controls="coaching-settings-editor"/);
  assert.match(settings, /What Beckett helps with/);
});

test("public beta positioning stays immediate, professional, and evidence-based", () => {
  const home = read("app/page.tsx");
  assert.match(home, /inside the apps where you work/);
  assert.match(home, /Conversations you can practice/);
  assert.doesNotMatch(home, /What people say|personalTestimonials|professionalTestimonials/);

  assert.match(read("lib/beta-access.ts"), /return false/);
  assert.doesNotMatch(read("app/pricing/page.tsx"), /Free after beta|welcome credits/);
  assert.match(read("app/skills/page.tsx"), /Available now/);
  assert.match(read("app/skills/page.tsx"), /Coming during beta/);
});

test("user settings and app connections match the beta product surface", () => {
  const settings = read("components/dashboard/SettingsPanel.tsx");
  assert.doesNotMatch(settings, /Beta diagnostics|loadDiagnostics/);

  const apps = read("components/dashboard/AppsPanel.tsx");
  assert.match(apps, /GoogleWorkspaceCard/);
  assert.match(apps, /Connect Gmail coaching and read-only Calendar preparation independently/);

  assert.doesNotMatch(read("components/dashboard/TodayGuide.tsx"), /workday-reminders/);
  assert.doesNotMatch(read("components/dashboard/WorkdayCheckinCard.tsx"), /workday-reminders/);
});
