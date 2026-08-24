import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("production manifest keeps the certified Outlook identity and surfaces", () => {
  const manifest = read("docs/outlook-addin-manifest-production.xml");
  assert.match(manifest, /<Id>90c2f2db-20b8-4c6f-91e7-9cba3b5c4b5e<\/Id>/);
  assert.match(manifest, /<Version>1\.0\.0\.3<\/Version>/);
  assert.match(manifest, /<ProviderName>Beckett Labs Inc\.<\/ProviderName>/);
  assert.match(manifest, /<SupportUrl DefaultValue="https:\/\/www\.meetbeckett\.co\/support"/);
  assert.match(manifest, /<SourceLocation DefaultValue="https:\/\/www\.meetbeckett\.co\/outlook-addin"/);
  assert.match(manifest, /<Permissions>ReadWriteItem<\/Permissions>/);
  assert.match(manifest, /<Set Name="Mailbox" MinVersion="1\.5"/);
  assert.match(manifest, /MessageReadCommandSurface/);
  assert.match(manifest, /MessageComposeCommandSurface/);
  assert.match(manifest, /<SupportsPinning>true<\/SupportsPinning>/);
  for (const size of [16, 32, 64, 80, 128]) {
    assert.match(manifest, new RegExp(`outlook-addin-icon-${size}\\.png`));
  }
});

test("task pane has NAA plus a memory-only Office dialog fallback", () => {
  const pane = read("app/outlook-addin/page.tsx");
  assert.match(pane, /isSetSupported\?\.\("NestedAppAuth", "1\.1"\)/);
  assert.match(pane, /BrowserCacheLocation\.MemoryStorage/);
  assert.match(pane, /displayDialogAsync/);
  assert.match(pane, /Sign in to Beckett/);
  assert.match(pane, /Use another sign-in method/);
  assert.match(pane, /chooseAnotherSignInMethod/);
  assert.match(pane, /Opening Microsoft sign-in/);
  assert.match(pane, /withTimeout/);
  assert.match(pane, /Beckett never sends email/);
  assert.match(pane, /secure fallback for Outlook clients/);
  assert.match(pane, /beckett-outlook-auth/);
  assert.doesNotMatch(pane, /localStorage|sessionStorage/);

  const completion = read("app/outlook-addin/auth-complete/page.tsx");
  assert.match(completion, /appsforoffice\.microsoft\.com\/lib\/1\/hosted\/Office\.js/);
  assert.match(completion, /messageParent/);
  assert.match(completion, /session\?\.access_token/);
  assert.doesNotMatch(completion, /refresh_token/);
});

test("task pane has an Outlook-webview-compatible copy fallback", () => {
  const pane = read("app/outlook-addin/page.tsx");
  assert.match(pane, /document\.execCommand\("copy"\)/);
  assert.match(pane, /navigator\.clipboard\.writeText/);
  assert.match(pane, /Copy was blocked by Outlook/);
});

test("full-thread access requests Mail.Read incrementally and returns safely", () => {
  const oauth = read("lib/microsoft-oauth.ts");
  const mailDeclaration = oauth.match(/export const MICROSOFT_MAIL_SCOPES = ([^;]+);/)?.[0] || "";
  assert.match(mailDeclaration, /Mail\.Read/);
  assert.doesNotMatch(mailDeclaration, /Calendars\.ReadBasic|Calendars\.ReadWrite|Mail\.ReadWrite/);

  const pane = read("app/outlook-addin/page.tsx");
  assert.match(pane, /permission=mail/);
  assert.match(pane, /kind", "mail"/);
  assert.match(pane, /Analyze full thread/);

  const start = read("app/api/outlook-link/start/route.ts");
  const claim = read("app/api/outlook-link/claim/route.ts");
  const status = read("app/api/outlook-link/status/route.ts");
  assert.match(start, /permission.*mail/s);
  assert.match(claim, /requestMailPermission/);
  assert.match(status, /mailConnected/);

  const connect = read("app/api/microsoft/connect/route.ts");
  const callback = read("app/api/microsoft/oauth/callback/route.ts");
  assert.match(connect, /safeInternalPath/);
  assert.match(connect, /beckett_microsoft_oauth_next/);
  assert.match(callback, /safeInternalPath/);
  assert.match(callback, /beckett_microsoft_oauth_next/);
});

test("review documentation matches the production package and user-visible actions", () => {
  const submission = read("docs/outlook-marketplace-submission.md");
  assert.match(submission, /Manifest version: `1\.0\.0\.3`/);
  assert.match(submission, /Decode for Outlook/);
  assert.doesNotMatch(submission, /Decode Outlook/);
  assert.match(submission, /Beckett Labs Inc\./);
  assert.match(submission, /Analyze message/);
  assert.match(submission, /Analyze full thread/);
  assert.match(submission, /npm run verify:outlook/);
  assert.doesNotMatch(submission, /Read selected item|Decode with Beckett|Refresh sign-in/);
});
