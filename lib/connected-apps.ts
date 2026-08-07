export const CONNECTED_APP_IDS = [
  "gmail",
  "google_calendar",
  "slack",
  "outlook",
  "microsoft_calendar",
  "chrome",
] as const;

export type ConnectedAppId = (typeof CONNECTED_APP_IDS)[number];

export type ConnectedAppDefinition = {
  id: ConnectedAppId;
  name: string;
  shortName: string;
  description: string;
  mark: string;
  markClassName: string;
  connectHref: string;
  connectLabel: string;
  steps: string[];
  sharedProvider?: "microsoft";
};

export const CONNECTED_APPS: ConnectedAppDefinition[] = [
  {
    id: "gmail",
    name: "Gmail",
    shortName: "Gmail",
    description: "Analyze selected email conversations and draft replies.",
    mark: "M",
    markClassName: "bg-red-50 text-red-600",
    connectHref: "/api/gmail/oauth/start?next=/dashboard/apps",
    connectLabel: "Continue with Google",
    steps: [
      "Choose Continue with Google and approve Gmail read access.",
      "Install Beckett from Google Workspace Marketplace when it becomes publicly available.",
      "In Gmail, open a conversation and choose Beckett from the right sidebar.",
    ],
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    shortName: "Google Calendar",
    description: "Use selected calendars for meeting context and preparation.",
    mark: "31",
    markClassName: "bg-blue-50 text-blue-600",
    connectHref: "/api/calendar/oauth/start?next=/dashboard/apps",
    connectLabel: "Continue with Google",
    steps: [
      "Choose Continue with Google and approve read-only Calendar access.",
      "Return to Beckett and choose which calendars it may use.",
      "You can change the selected calendars from the Calendar page at any time.",
    ],
  },
  {
    id: "slack",
    name: "Slack",
    shortName: "Slack",
    description: "Ask Beckett for coaching inside your Slack workspace.",
    mark: "S",
    markClassName: "bg-fuchsia-50 text-fuchsia-600",
    connectHref: "/api/slack/connect",
    connectLabel: "Add to Slack",
    steps: [
      "Choose Add to Slack and select the workspace you use for work.",
      "Review and approve the requested Slack permissions.",
      "Use Beckett from Slack messages or with the /beckett command.",
    ],
  },
  {
    id: "outlook",
    name: "Outlook",
    shortName: "Outlook",
    description: "Analyze a selected Outlook message and insert coached wording.",
    mark: "O",
    markClassName: "bg-sky-50 text-sky-600",
    connectHref: "/api/microsoft/connect",
    connectLabel: "Connect Microsoft 365",
    sharedProvider: "microsoft",
    steps: [
      "Connect the Microsoft 365 account you use in Outlook.",
      "Install the Beckett Outlook add-in from Microsoft AppSource when it becomes publicly available.",
      "Open a message in Outlook and choose Beckett from Apps or the ribbon.",
    ],
  },
  {
    id: "microsoft_calendar",
    name: "Microsoft Calendar",
    shortName: "Microsoft Calendar",
    description: "Use selected Microsoft calendars for meeting context.",
    mark: "31",
    markClassName: "bg-indigo-50 text-indigo-600",
    connectHref: "/api/microsoft/connect",
    connectLabel: "Connect Microsoft 365",
    sharedProvider: "microsoft",
    steps: [
      "Connect the same Microsoft 365 account used for Outlook.",
      "Return to Beckett and choose which calendars it may use.",
      "One Microsoft authorization powers both Outlook and Microsoft Calendar.",
    ],
  },
  {
    id: "chrome",
    name: "Beckett for Chrome",
    shortName: "Chrome",
    description: "Use Beckett from supported pages in your browser.",
    mark: "C",
    markClassName: "bg-emerald-50 text-emerald-600",
    connectHref: "https://chromewebstore.google.com/detail/beckett/calejchnmkljjkgchnodpdojmammmddk",
    connectLabel: "Open Chrome Web Store",
    steps: [
      "Install Beckett from the Chrome Web Store.",
      "Open the Beckett side panel and choose Log in with Beckett.",
      "Finish the secure account connection in the new tab, then return to the extension.",
    ],
  },
];

export function isConnectedAppId(value: unknown): value is ConnectedAppId {
  return typeof value === "string" && CONNECTED_APP_IDS.includes(value as ConnectedAppId);
}

