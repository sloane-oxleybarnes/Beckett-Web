import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const appId = (process.env.MICROSOFT_TEAMS_APP_ID || "").trim();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(appId)) {
  throw new Error("Set MICROSOFT_TEAMS_APP_ID to the registered Teams bot application GUID.");
}
const validDomain = (process.env.MICROSOFT_TEAMS_VALID_DOMAIN || "www.meetbeckett.co").trim().toLowerCase();
if (!/^[a-z0-9.-]+$/.test(validDomain) || validDomain.includes("..")) {
  throw new Error("MICROSOFT_TEAMS_VALID_DOMAIN must be a hostname");
}

const root = process.cwd();
const source = resolve(root, "teams-app");
const build = resolve(source, "build");
mkdirSync(build, { recursive: true });
const manifest = readFileSync(resolve(source, "manifest.template.json"), "utf8")
  .replaceAll("__MICROSOFT_TEAMS_APP_ID__", appId)
  .replaceAll("__MICROSOFT_TEAMS_VALID_DOMAIN__", validDomain);
JSON.parse(manifest);
writeFileSync(resolve(build, "manifest.json"), manifest);
copyFileSync(resolve(source, "color.png"), resolve(build, "color.png"));
copyFileSync(resolve(source, "outline.png"), resolve(build, "outline.png"));
const archive = resolve(source, "beckett-teams.zip");
rmSync(archive, { force: true });
execFileSync("zip", ["-q", "-j", archive, resolve(build, "manifest.json"), resolve(build, "color.png"), resolve(build, "outline.png")]);
console.log(`Created ${archive}`);
