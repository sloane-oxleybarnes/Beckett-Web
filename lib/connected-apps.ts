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
  iconSrc: string;
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
    iconSrc: "/brand/connected-apps/gmail.png",
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
    iconSrc: "/brand/connected-apps/google-calendar.png",
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
    iconSrc: "/brand/connected-apps/slack.png",
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
    iconSrc: "/brand/connected-apps/outlook.png",
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
    iconSrc: "/brand/connected-apps/microsoft-calendar.png",
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
    iconSrc: "/brand/connected-apps/chrome.png",
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
