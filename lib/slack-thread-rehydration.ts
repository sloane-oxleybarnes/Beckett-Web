export type SlackThreadTurn = {
  role: "user" | "beckett" | "other";
  userId: string | null;
  text: string;
  ts: string | null;
};

export type RehydratedSlackGuestPrep = {
  threadTs: string;
  step: "person" | "location" | "outcome" | "concern" | "complete";
  person?: string;
  location?: "written" | "call" | "in_person";
  outcome?: string;
  concern?: string;
};

function guestLocationFromAnswer(text: string): RehydratedSlackGuestPrep["location"] | undefined {
  if (/\b(slack|written|message|dm|channel|text)\b/i.test(text)) return "written";
  if (/\b(call|phone|video|zoom|meet|teams)\b/i.test(text)) return "call";
  if (/\b(in[ -]?person|face[ -]?to[ -]?face|office)\b/i.test(text)) return "in_person";
  return undefined;
}

export function withoutLatestSlackUserTurn(turns: SlackThreadTurn[], latestUserText?: string | null) {
  const prior = [...turns];
  const expected = latestUserText?.replace(/\s+/g, " ").trim();
  if (!expected) return prior;
  for (let index = prior.length - 1; index >= 0; index -= 1) {
    if (prior[index].role === "user" && prior[index].text.replace(/\s+/g, " ").trim() === expected) {
      prior.splice(index, 1);
      break;
    }
  }
  return prior;
}

export function rehydrateSlackGuestPrepFromTurns(
  threadTs: string,
  turns: SlackThreadTurn[],
  currentStep: RehydratedSlackGuestPrep["step"] = "person"
): RehydratedSlackGuestPrep {
  const state: RehydratedSlackGuestPrep = { threadTs, step: currentStep };
  let lastBeckett = "";
  for (const turn of turns) {
    if (turn.role === "beckett") {
      lastBeckett = turn.text;
      continue;
    }
    if (turn.role !== "user") continue;
    if (/who (?:are you talking to|should i role-play)/i.test(lastBeckett)) {
      state.person = turn.text;
      state.location = guestLocationFromAnswer(turn.text) || state.location;
    } else if (/where will this conversation happen|will this happen in a written message/i.test(lastBeckett)) {
      state.location = guestLocationFromAnswer(turn.text) || state.location;
    } else if (/what outcome do you want/i.test(lastBeckett)) {
      state.outcome = turn.text;
    } else if (/what are you most concerned|what are you worried/i.test(lastBeckett)) {
      state.concern = turn.text;
    }
  }
  if (state.person && state.location && state.outcome && state.concern) state.step = "complete";
  return state;
}
