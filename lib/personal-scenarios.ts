export type PersonalScenario = { pillar: "boundaries" | "friendship" | "family_roommates" | "dating"; title: string; prompt: string; skill: string };
export const personalScenarios: PersonalScenario[] = [
  { pillar: "boundaries", title: "Say no without over-explaining", prompt: "I need to say no while staying respectful.", skill: "Clear limits" },
  { pillar: "boundaries", title: "Repair a misunderstanding", prompt: "I want to acknowledge impact and reset the conversation.", skill: "Repair" },
  { pillar: "friendship", title: "Make a plan", prompt: "I want to suggest a concrete plan without sounding demanding.", skill: "Initiating" },
  { pillar: "friendship", title: "Reconnect", prompt: "I want to reach out after some time apart.", skill: "Reconnection" },
  { pillar: "family_roommates", title: "Ask for a change", prompt: "I need to raise a recurring household issue clearly.", skill: "Collaborative requests" },
  { pillar: "family_roommates", title: "Set an expectation", prompt: "I want to clarify what I need going forward.", skill: "Expectations" },
  { pillar: "dating", title: "Express interest", prompt: "I want to show interest with a clear, low-pressure invitation.", skill: "Directness" },
  { pillar: "dating", title: "Respond to ambiguity", prompt: "I want to ask for clarity without pressuring the other person.", skill: "Pacing" },
];
