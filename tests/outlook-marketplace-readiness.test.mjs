import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path, encoding = "utf8") => readFile(new URL(path, root), encoding);

function pngDimensions(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", "asset must be a PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("production manifest stays read-only and uses public production URLs", async () => {
  const manifest = await read("docs/outlook-addin-manifest-production.xml");

  assert.match(manifest, /<Permissions>ReadItem<\/Permissions>/);
  assert.match(manifest, /MessageReadCommandSurface/);
  assert.match(manifest, /selected Microsoft Outlook messages/);
  assert.doesNotMatch(manifest, /MessageComposeCommandSurface|AppointmentOrganizerCommandSurface|ReadWriteItem|ReadWriteMailbox/);
  assert.match(manifest, /https:\/\/www\.meetbeckett\.co\/outlook-addin/);
  assert.match(manifest, /https:\/\/www\.meetbeckett\.co\/support/);

  for (const size of [16, 32, 64, 80, 128]) {
    assert.match(manifest, new RegExp(`https://www\\.meetbeckett\\.co/brand/outlook-icon-${size}\\.png`));
  }
});

test("manifest icon assets have their declared exact dimensions", async () => {
  for (const size of [16, 32, 64, 80, 128]) {
    const image = await read(`public/brand/outlook-icon-${size}.png`, null);
    assert.deepEqual(pngDimensions(image), { width: size, height: size });
  }
  const marketplaceIcon = await read("public/brand/outlook-marketplace-icon-300.png", null);
  assert.deepEqual(pngDimensions(marketplaceIcon), { width: 300, height: 300 });
});

test("task pane exposes account controls without mutating Outlook items", async () => {
  const taskPane = await read("app/outlook-addin/page.tsx");

  assert.match(taskPane, /Sign in to Beckett/);
  assert.match(taskPane, /Create account/);
  assert.match(taskPane, /Sign out/);
  assert.match(taskPane, /Decode with Beckett/);
  assert.doesNotMatch(taskPane, /setSelectedDataAsync|displayReplyForm|displayNewMessageForm/);
});

test("submission support and disclosure surfaces are present", async () => {
  const [support, privacy, terms, listing] = await Promise.all([
    read("app/support/page.tsx"),
    read("app/privacy/page.tsx"),
    read("app/terms/page.tsx"),
    read("docs/outlook-marketplace-listing.md"),
  ]);

  assert.match(support, /hello@meetbeckett\.co/);
  assert.match(privacy, /add-in for Microsoft Outlook/);
  assert.match(privacy, /configured AI provider/);
  assert.match(terms, /Beckett Labs Inc/);
  assert.match(terms, /Microsoft, Microsoft 365, and Outlook are trademarks of the Microsoft group of companies/);
  assert.match(listing, /Microsoft, Microsoft 365, and Outlook are trademarks of the Microsoft group of companies/);
  assert.doesNotMatch(`${support}\n${privacy}\n${listing}`, /Beckett for Outlook/);
  assert.match(listing, /\[PARTNER CENTER ONLY\]/);
  assert.doesNotMatch(listing, /Reviewer password:\s*`(?!\[PARTNER CENTER ONLY\])/);
});
