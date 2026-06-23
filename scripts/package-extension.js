const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const extensionDir = path.join(root, "extension");
const distDir = path.join(root, "dist");
const args = process.argv.slice(2);
const isStaging = args.includes("--staging");
const shouldZip = !isStaging || args.includes("--zip");
const packageName = isStaging ? "beckett-extension-staging" : "beckett-extension";
const packageDir = path.join(distDir, packageName);
const zipPath = path.join(distDir, `${packageName}.zip`);

const include = [
  "manifest.json",
  "PRIVACY.md",
  "background/service_worker.js",
  "content/gmail.js",
  "content/slack.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "popup/popup.css",
  "popup/popup.html",
  "popup/popup.js",
  "sidebar/panel.js",
  "sidebar/sidebar.css",
  "sidebar/sidebar.html",
  "sidebar/sidebar.js",
  "utils/api.js",
  "utils/gmail.js",
  "utils/prompts.js",
];

function readArg(name) {
  const withEquals = args.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) return withEquals.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];

  return "";
}

function normalizeSiteUrl(value) {
  const fallback = isStaging ? "https://staging.meetbeckett.co" : "https://www.meetbeckett.co";
  const raw = (value || fallback).trim().replace(/\/+$/, "");

  try {
    return new URL(raw).origin;
  } catch {
    throw new Error(`Invalid site URL: ${raw}`);
  }
}

function hostPermissionFor(siteUrl) {
  const parsed = new URL(siteUrl);
  const hostname = parsed.hostname === "127.0.0.1" ? "localhost" : parsed.hostname;
  return `${parsed.protocol}//${hostname}/*`;
}

function replaceInFile(relativePath, replacements) {
  const filePath = path.join(packageDir, relativePath);
  let text = fs.readFileSync(filePath, "utf8");
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  fs.writeFileSync(filePath, text);
}

function configureStagingPackage(siteUrl) {
  const manifestPath = path.join(packageDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.name = "Beckett Staging";
  manifest.description = "Local staging build for Beckett workplace communication coaching.";
  manifest.host_permissions = [
    "https://mail.google.com/*",
    "https://app.slack.com/*",
    hostPermissionFor(siteUrl),
    "https://gmail.googleapis.com/*",
    "https://slack.com/api/*",
  ];
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const replacements = [
    ["https://www.meetbeckett.co", siteUrl],
    ["https://meetbeckett.co", siteUrl],
    [
      "return parsed.hostname === 'meetbeckett.co' || parsed.hostname === 'www.meetbeckett.co';",
      "return parsed.origin === BECKETT_SITE;",
    ],
  ];

  [
    "background/service_worker.js",
    "popup/popup.html",
    "sidebar/panel.js",
    "sidebar/sidebar.html",
  ].forEach((relativePath) => replaceInFile(relativePath, replacements));
}

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });
fs.rmSync(zipPath, { force: true });

for (const relativePath of include) {
  const source = path.join(extensionDir, relativePath);
  const target = path.join(packageDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

if (isStaging) {
  const siteUrl = normalizeSiteUrl(readArg("--site") || process.env.BECKETT_STAGING_SITE_URL);
  configureStagingPackage(siteUrl);
  console.log(`Configured staging extension for ${siteUrl}`);
}

if (shouldZip) {
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: packageDir, stdio: "inherit" });
  console.log(`Created ${zipPath}`);
}

console.log(`Created unpacked extension at ${packageDir}`);
