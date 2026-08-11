import assert from "node:assert/strict";
import test from "node:test";

import {
  rehydrateSlackGuestPrepFromTurns,
  withoutLatestSlackUserTurn,
} from "../lib/slack-thread-rehydration.ts";

const turn = (role, text, ts) => ({ role, text, ts, userId: role === "user" ? "U123" : null });

test("guest Prep state is reconstructed entirely from the live Slack thread", () => {
  const state = rehydrateSlackGuestPrepFromTurns("1720000000.000100", [
    turn("beckett", "First, who are you talking to, and what is the conversation about?", "1"),
    turn("user", "My manager about changing priorities", "2"),
    turn("beckett", "Where will this conversation happen?", "3"),
    turn("user", "On a video call", "4"),
    turn("beckett", "What outcome do you want from the conversation?", "5"),
    turn("user", "Agreement on what I can defer", "6"),
    turn("beckett", "What are you most concerned they may misunderstand?", "7"),
    turn("user", "That I am refusing to help", "8"),
  ], "concern");

  assert.deepEqual(state, {
    threadTs: "1720000000.000100",
    step: "complete",
    person: "My manager about changing priorities",
    location: "call",
    outcome: "Agreement on what I can defer",
    concern: "That I am refusing to help",
  });
});

test("the incoming Slack event is excluded before replaying its guided step", () => {
  const turns = [
    turn("beckett", "What outcome do you want from the conversation?", "1"),
    turn("user", "A clear decision", "2"),
  ];

  assert.deepEqual(withoutLatestSlackUserTurn(turns, " A clear   decision "), [turns[0]]);
});

test("messages from other Slack participants are not treated as requester answers", () => {
  const state = rehydrateSlackGuestPrepFromTurns("thread", [
    turn("beckett", "What outcome do you want from the conversation?", "1"),
    turn("other", "Ship it today", "2"),
  ], "outcome");

  assert.equal(state.outcome, undefined);
  assert.equal(state.step, "outcome");
});
