import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildShortcutPrompt,
  selectedMessageContextInstruction,
  selectedMessageOpener,
  selectedMessageThreadReply,
  shortcutSourceAckText,
} from "../features/slack/interaction-contracts.ts";

const otherPersonPayload = {
  user: { id: "U_REQUESTER" },
  message: { user: "U_AUTHOR", text: "thinner so i can annoy you more" },
  channel: { id: "D123", name: "directmessage" },
};

test("message shortcut prompt maps requester and author identities explicitly", () => {
  const prompt = buildShortcutPrompt(otherPersonPayload, "Claire", "decode", "Sloane");

  assert.match(prompt, /Requester Slack identity: Sloane/);
  assert.match(prompt, /Selected-message author: Claire/);
  assert.match(prompt, /different Slack users/);
});

test("message shortcut recognizes a requester selecting their own message", () => {
  const payload = {
    ...otherPersonPayload,
    message: { ...otherPersonPayload.message, user: "U_REQUESTER" },
  };
  const prompt = buildShortcutPrompt(payload, "Sloane", "decode", "Sloane");
  const opener = selectedMessageOpener("decode", "Sloane", payload.message.text, true);

  assert.match(prompt, /selected their own message/i);
  assert.match(opener, /^Decode your message/);
  assert.doesNotMatch(opener, /from Sloane/);
});

test("unavailable surrounding context forces an ambiguity-safe Decode", () => {
  const instruction = selectedMessageContextInstruction("decode", false);

  assert.match(instruction, /do not invent what they refer to/i);
  assert.match(instruction, /1–3 messages immediately before/i);
  assert.equal(selectedMessageContextInstruction("decode", true), "");
});

test("Decode uses a compact root and puts the result plus add-context path in a reply", () => {
  const root = selectedMessageOpener(
    "decode",
    "Claire",
    "thinner so i can annoy you more",
  );
  const reply = selectedMessageThreadReply({
    response: "~ Possible read ~ “Thinner” is ambiguous without the earlier messages.\n~ Next move ~ Share what you were discussing immediately before this.",
    surroundingContextAvailable: false,
  });

  assert.equal(root, "Decode from Claire: “thinner so i can annoy you more”");
  assert.doesNotMatch(reply, /thinner so i can annoy you more/);
  assert.match(reply, /Reply here with the 1–3 messages immediately before/i);
  assert.doesNotMatch(root, /Let’s read this message privately/);
});

test("source conversation receives one short plain-text acknowledgement", () => {
  const ack = shortcutSourceAckText();
  const handler = readFileSync(
    new URL("../features/slack/interactions/core-actions.ts", import.meta.url),
    "utf8"
  );

  assert.equal(ack, "Opened privately in Beckett.");
  assert.ok(ack.length < 40);
  assert.doesNotMatch(handler, /Beckett is reading that message/);
});
