import { App } from "@microsoft/teams.apps";
import type { ILogger } from "@microsoft/teams.common";
import {
  buildTeamsTaskDialogResponse,
  buildTeamsTaskErrorResponse,
  parseTeamsMessageAction,
  TeamsMessageActionError,
} from "./contracts";
import { NextTeamsHttpAdapter } from "./http-adapter";
import { encryptTeamsActionToken } from "@/lib/teams-action-token";

class TeamsSafeLogger implements ILogger {
  loggerOptions = { level: "warn" as const };
  debug() {}
  info() {}
  trace() {}
  warn(...message: unknown[]) { this.write("warn", message); }
  error(...message: unknown[]) { this.write("error", message); }
  log(level: "error" | "warn" | "info" | "debug" | "trace", ...message: unknown[]) {
    if (level === "error" || level === "warn") this.write(level, message);
  }
  child() { return this; }
  private write(level: "warn" | "error", message: unknown[]) {
    const safe = message.find((value) => typeof value === "string");
    const text = typeof safe === "string"
      ? safe.replace(/[\r\n\t\x00-\x1f\x7f]/g, " ").slice(0, 180)
      : "Microsoft Teams request failed";
    console[level](text);
  }
}

const adapter = new NextTeamsHttpAdapter();
const teamsApp = new App({
  clientId: process.env.MICROSOFT_TEAMS_APP_ID?.trim(),
  clientSecret: process.env.MICROSOFT_TEAMS_APP_SECRET?.trim(),
  tenantId: process.env.MICROSOFT_TEAMS_TENANT_ID?.trim(),
  httpServerAdapter: adapter,
  messagingEndpoint: "/api/teams/messages",
  logger: new TeamsSafeLogger(),
  dangerouslyAllowUnauthenticatedRequests: false,
});

teamsApp.on("message.ext.open", async ({ activity }) => {
  try {
    const action = parseTeamsMessageAction(activity);
    const token = encryptTeamsActionToken({
      activityId: action.activityId,
      aadObjectId: action.aadObjectId,
      tenantId: action.tenantId,
      intent: action.intent,
      messageText: action.messageText,
    });
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://meetbeckett.co").replace(/\/$/, "");
    return buildTeamsTaskDialogResponse(`${origin}/teams/action#token=${encodeURIComponent(token)}`, action.intent);
  } catch (error) {
    if (error instanceof TeamsMessageActionError) return buildTeamsTaskErrorResponse(error.message);
    console.error("Microsoft Teams action could not open");
    return buildTeamsTaskErrorResponse("Beckett could not open this message. Please try again.");
  }
});

let initialization: Promise<void> | null = null;

async function initializeTeamsApp() {
  initialization ||= teamsApp.initialize();
  return initialization;
}

export async function handleTeamsHttpRequest(body: unknown, headers: Record<string, string>) {
  await initializeTeamsApp();
  return adapter.handle("POST", "/api/teams/messages", body, headers);
}
