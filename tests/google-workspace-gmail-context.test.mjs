import assert from "node:assert/strict";
import test from "node:test";

import {
  gmailInteractionDedupeKey,
  gmailParticipantEmails,
  gmailPrimaryCounterpartEmail,
  threadForPrompt,
} from "../lib/google-workspace-gmail.ts";
import { summarizeSelectedGmailVoicePattern } from "../lib/google-workspace-voice-pattern-summary.ts";

const thread = {
  id: "thread-1",
  selectedMessageId: "message-3",
  messages: [
    {
      id: "message-1",
      threadId: "thread-1",
      subject: "Project update",
      from: "Jordan <jordan@example.com>",
      fromEmail: "jordan@example.com",
      to: "Sloane <sloane@meetbeckett.co>",
      date: "Monday",
      messageIdHeader: "one@example.com",
      references: "",
      body: "Hi Sloane,\n\nCould you confirm the timeline?",
    },
    {
      id: "message-2",
      threadId: "thread-1",
      subject: "Re: Project update",
      from: "Sloane <sloane@meetbeckett.co>",
      fromEmail: "sloane@meetbeckett.co",
      to: "Jordan <jordan@example.com>",
      date: "Tuesday",
      messageIdHeader: "two@example.com",
      references: "one@example.com",
      body: "Hi Jordan,\n\nYes. I can confirm:\n- Design by Thursday\n- Review on Friday\n\nThanks,\nSloane",
    },
    {
      id: "message-3",
      threadId: "thread-1",
      subject: "Re: Project update",
      from: "Sloane <sloane@meetbeckett.co>",
      fromEmail: "sloane@meetbeckett.co",
      to: "Jordan <jordan@example.com>",
      date: "Wednesday",
      messageIdHeader: "three@example.com",
      references: "one@example.com two@example.com",
      body: "Hi Jordan,\n\nOne more detail:\n- Launch remains Monday\n\nThanks,\nSloane",
    },
  ],
};

test("labels the verified Gmail user only as You", () => {
  const prompt = threadForPrompt(thread, "sloane@meetbeckett.co");
  assert.match(prompt, /Message 2 from You/);
  assert.doesNotMatch(prompt, /You \(Sloane/);
});

test("finds the other Gmail participant and ignores the signed-in user", () => {
  assert.deepEqual(gmailParticipantEmails(thread, "sloane@meetbeckett.co"), ["jordan@example.com"]);
  assert.equal(gmailPrimaryCounterpartEmail(thread, "sloane@meetbeckett.co"), "jordan@example.com");
});

test("creates a stable non-raw interaction dedupe key", () => {
  const first = gmailInteractionDedupeKey(thread);
  const second = gmailInteractionDedupeKey(thread);
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /message|thread/);
});

test("derives an opt-in voice pattern without retaining email text", () => {
  const pattern = summarizeSelectedGmailVoicePattern(thread, "sloane@meetbeckett.co");
  assert.equal(pattern?.sampleCount, 2);
  assert.match(pattern?.evidenceSummary || "", /opens with a greeting/);
  assert.match(pattern?.evidenceSummary || "", /bullets/);
  assert.doesNotMatch(JSON.stringify(pattern), /Launch remains Monday/);
});
