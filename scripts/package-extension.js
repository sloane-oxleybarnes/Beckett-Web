const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const extensionDir = path.join(root, "extension");
const distDir = path.join(root, "dist");
const packageDir = path.join(distDir, "beckett-extension");
const zipPath = path.join(distDir, "beckett-extension.zip");

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

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });
fs.rmSync(zipPath, { force: true });

for (const relativePath of include) {
  const source = path.join(extensionDir, relativePath);
  const target = path.join(packageDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

execFileSync("zip", ["-qr", zipPath, "."], { cwd: packageDir, stdio: "inherit" });
console.log(`Created ${zipPath}`);
