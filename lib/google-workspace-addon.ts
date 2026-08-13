import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { NextRequest, NextResponse } from "next/server";
import { integrationsRepository } from "@/lib/repositories/integrations-repository";
import { WEB_CREDITS_ENABLED } from "@/lib/web-credits";
import {
  workspaceAddOnErrorCode,
  workspaceAddOnErrorStatus,
  workspaceAddOnLogRecord,
  workspaceAddOnRequestId,
  type WorkspaceAddOnVerificationStage,
} from "@/lib/google-workspace-addon-diagnostics";

export type WorkspaceAddOnEvent = {
  authorizationEventObject?: {
    userOAuthToken?: string;
    userIdToken?: string;
    systemIdToken?: string;
    authorizedScopes?: string[];
  };
  commonEventObject?: {
    hostApp?: string;
    platform?: string;
    parameters?: Record<string, string>;
    formInputs?: Record<string, { stringInputs?: { value?: string[] } }>;
  };
  gmail?: {
    messageId?: string;
    threadId?: string;
    accessToken?: string;
  };
};

export type WorkspaceAddOnProfile = {
  id: string;
  email: string | null;
  plan: string | null;
  googleSubject: string;
  googleEmail: string;
  patternModelEnabled: boolean;
};

export type WorkspaceAddOnDiagnostics = {
  requestId: string;
  route: string;
  stage: WorkspaceAddOnVerificationStage;
  setStage: (stage: WorkspaceAddOnVerificationStage) => void;
};

type CardHeader = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageType?: "CIRCLE" | "SQUARE";
  imageAltText?: string;
};

export type Card = {
  name?: string;
  header?: CardHeader;
  sections: Array<{
    header?: string;
    collapsible?: boolean;
    uncollapsibleWidgetsCount?: number;
    widgets: Array<Record<string, unknown>>;
  }>;
  fixedFooter?: Record<string, unknown>;
  sectionDividerStyle?: "SOLID_DIVIDER" | "NO_DIVIDER";
  displayStyle?: "PEEK" | "REPLACE";
  peekCardHeader?: CardHeader;
};

const googleAuth = new OAuth2Client();
const BECKETT_BUTTON_COLOR = { red: 0.729, green: 0.459, blue: 0.09 };

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function requestAudience(request: NextRequest) {
  const configuredOrigin = process.env.GOOGLE_WORKSPACE_ADDON_ORIGIN?.replace(/\/$/, "");
  if (!configuredOrigin) return request.nextUrl.origin + request.nextUrl.pathname;
  return configuredOrigin + request.nextUrl.pathname;
}

export async function readWorkspaceAddOnEvent(request: NextRequest) {
  const event = (await request.json().catch(() => null)) as WorkspaceAddOnEvent | null;
  if (!event || typeof event !== "object") throw new Error("invalid_event");
  return event;
}

export async function verifyWorkspaceAddOnRequest(request: NextRequest, event: WorkspaceAddOnEvent) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
  const idToken = bearer || event.authorizationEventObject?.systemIdToken || "";
  if (!idToken) throw new Error("missing_system_token");

  const ticket = await googleAuth.verifyIdToken({
    idToken,
    audience: requestAudience(request),
  });
  const payload = ticket.getPayload();
  const expectedEmail = requiredEnv("GOOGLE_WORKSPACE_ADDON_SERVICE_ACCOUNT_EMAIL");
  if (!payload?.email_verified || payload.email !== expectedEmail) {
    throw new Error("invalid_system_token");
  }
}

export async function verifyWorkspaceAddOnUser(event: WorkspaceAddOnEvent): Promise<TokenPayload> {
  const idToken = event.authorizationEventObject?.userIdToken || "";
  if (!idToken) throw new Error("missing_user_token");
  const ticket = await googleAuth.verifyIdToken({
    idToken,
    audience: requiredEnv("GOOGLE_WORKSPACE_ADDON_CLIENT_ID"),
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified === false) {
    throw new Error("invalid_user_token");
  }
  return payload;
}

export async function resolveWorkspaceAddOnProfile(
  event: WorkspaceAddOnEvent,
  diagnostics?: WorkspaceAddOnDiagnostics,
): Promise<WorkspaceAddOnProfile | null> {
  diagnostics?.setStage("account_resolution");
  const resolved = <T,>(value: T) => {
    diagnostics?.setStage("handler");
    return value;
  };

  const user = await verifyWorkspaceAddOnUser(event);
  const googleSubject = user.sub;
  const email = user.email!.trim().toLowerCase();

  const { data: mappedIntegration } = await integrationsRepository
    .from("user_integrations")
    .select("user_id")
    .eq("provider", "google_workspace_addon")
    .eq("external_user_id", googleSubject)
    .maybeSingle();

  let userId = mappedIntegration?.user_id || null;
  if (!userId) {
    const { data: profileByEmail } = await integrationsRepository
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    userId = profileByEmail?.id || null;
  }
  if (!userId) return resolved(null);

  const { data: profile } = await integrationsRepository
    .from("profiles")
    .select("id,email,plan,pattern_model_enabled")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return resolved(null);

  if (!mappedIntegration) {
    const now = new Date().toISOString();
    await integrationsRepository.from("user_integrations").upsert(
      {
        user_id: profile.id,
        provider: "google_workspace_addon",
        external_user_id: googleSubject,
        metadata: { email, source: "google_workspace_addon" },
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,provider" },
    );
  }

  return resolved({
    id: profile.id,
    email: profile.email,
    plan: profile.plan,
    googleSubject,
    googleEmail: email,
    patternModelEnabled: Boolean(profile.pattern_model_enabled),
  });
}

export function isWorkspaceAddOnPlanEligible(plan: string | null) {
  if (plan === "beta" || plan === "pro" || plan === "team") return true;
  return WEB_CREDITS_ENABLED && plan === "free";
}

export function endpointUrl(request: NextRequest, pathname: string) {
  const origin = process.env.GOOGLE_WORKSPACE_ADDON_ORIGIN?.replace(/\/$/, "") || request.nextUrl.origin;
  return `${origin}${pathname}`;
}

export function escapeCardText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCardText(value: string, maxLength = 12_000) {
  const trimmed = value.trim().slice(0, maxLength);
  return escapeCardText(trimmed).replace(/\n/g, "<br>");
}

export function formatCardRichText(value: string, maxLength = 12_000) {
  const lines = value.trim().slice(0, maxLength).split(/\r?\n/);
  return lines
    .map((line) => {
      const bulleted = line.replace(/^\s*[-*]\s+/, "• ");
      return escapeCardText(bulleted)
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/__(.+?)__/g, "<b>$1</b>");
    })
    .join("<br>");
}

export function parseLabeledSections(value: string, labels: Array<{ key: string; label: string }>) {
  const buckets = Object.fromEntries(labels.map(({ key }) => [key, [] as string[]])) as Record<string, string[]>;
  const normalizedLabels = labels.map(({ key, label }) => ({ key, label: label.toLowerCase() }));
  let currentKey: string | null = null;
  let foundHeading = false;

  for (const rawLine of value.split(/\r?\n/)) {
    const possibleHeading = rawLine
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.*?)\*\*$/, "$1")
      .replace(/^__(.*?)__$/, "$1")
      .replace(/:$/, "")
      .trim()
      .toLowerCase();
    const matched = normalizedLabels.find(({ label }) => possibleHeading === label);
    if (matched) {
      currentKey = matched.key;
      foundHeading = true;
      continue;
    }
    if (/^\s*-{3,}\s*$/.test(rawLine)) continue;
    if (!currentKey) continue;
    buckets[currentKey] ??= [];
    buckets[currentKey].push(rawLine);
  }

  if (!foundHeading && labels[0]) {
    buckets[labels[0].key] = value.split(/\r?\n/);
  }

  return Object.fromEntries(Object.entries(buckets).map(([key, lines]) => [key, lines.join("\n").trim()]));
}

export function beckettCardHeader(title: string, subtitle?: string): CardHeader {
  return {
    title,
    ...(subtitle ? { subtitle } : {}),
  };
}

export function brandedSectionHeader(label: string) {
  return `<font color="#BA7517"><b>${escapeCardText(label)}</b></font>`;
}

export function textWidget(text: string, maxLines?: number) {
  return { textParagraph: { text, ...(maxLines ? { maxLines } : {}) } };
}

export function textInputWidget(name: string, label: string, hintText: string, characterLimit = 1_000) {
  return {
    textInput: {
      name,
      label,
      hintText,
      type: "MULTIPLE_LINE",
      validation: { characterLimit, inputType: "TEXT" },
    },
  };
}

export function decoratedTextWidget(topLabel: string, text: string) {
  return { decoratedText: { topLabel, text, wrapText: true } };
}

export function buttonWidget(text: string, functionUrl: string, parameters?: Record<string, string>) {
  return {
    buttonList: {
      buttons: [
        {
          text,
          color: BECKETT_BUTTON_COLOR,
          onClick: {
            action: {
              function: functionUrl,
              ...(parameters
                ? { parameters: Object.entries(parameters).map(([key, value]) => ({ key, value })) }
                : {}),
            },
          },
        },
      ],
    },
  };
}

export function formSubmitButtonWidget(text: string, functionUrl: string, requiredWidgets: string[]) {
  return {
    buttonList: {
      buttons: [
        {
          text,
          color: BECKETT_BUTTON_COLOR,
          onClick: {
            action: {
              function: functionUrl,
              loadIndicator: "SPINNER",
              requiredWidgets,
            },
          },
        },
      ],
    },
  };
}

export function openLinkButtonWidget(text: string, url: string) {
  return {
    buttonList: {
      buttons: [
        {
          text,
          color: BECKETT_BUTTON_COLOR,
          onClick: { openLink: { url, onClose: "RELOAD", openAs: "OVERLAY" } },
        },
      ],
    },
  };
}

export function actionFixedFooter(text: string, functionUrl: string) {
  return {
    primaryButton: {
      text,
      color: BECKETT_BUTTON_COLOR,
      onClick: { action: { function: functionUrl } },
    },
  };
}

export function cardResponse(card: Card, stateChanged = false) {
  return NextResponse.json({
    ...(stateChanged ? { stateChanged: true } : {}),
    renderActions: { action: { navigations: [{ pushCard: card }] } },
  });
}

export function cardUpdateResponse(card: Card, stateChanged = false) {
  return NextResponse.json({
    ...(stateChanged ? { stateChanged: true } : {}),
    renderActions: { action: { navigations: [{ updateCard: card }] } },
  });
}

export function triggerCardResponse(card: Card) {
  return NextResponse.json({
    action: { navigations: [{ pushCard: card }] },
  });
}

export function errorCard(title: string, message: string): Card {
  return {
    header: beckettCardHeader("Beckett", title),
    sections: [{ widgets: [textWidget(formatCardText(message))] }],
  };
}

export async function signInCard(request: NextRequest, event: WorkspaceAddOnEvent): Promise<Card> {
  const { createWorkspaceAddOnConnectUrl } = await import("@/lib/google-workspace-addon-link");
  const connectUrl = await createWorkspaceAddOnConnectUrl(request, event);
  const parsedConnectUrl = new URL(connectUrl);
  const connectPath = parsedConnectUrl.pathname + parsedConnectUrl.search;
  const createAccountUrl = endpointUrl(
    request,
    `/auth/signup?source=google_workspace_addon&next=${encodeURIComponent(connectPath)}`,
  );
  return {
    header: beckettCardHeader("Connect Beckett", "Use your coaching context in Gmail"),
    sections: [
      {
        widgets: [
          textWidget("Connect this Google account to an existing Beckett account. You can use a different email address for Beckett."),
          openLinkButtonWidget("Connect Beckett account", connectUrl),
        ],
      },
      {
        widgets: [
          textWidget("New to Beckett? Create a free account, complete setup, and connect it to Gmail."),
          openLinkButtonWidget("Create free Beckett account", createAccountUrl),
        ],
      },
    ],
  };
}

export async function workspaceAddOnRoute(
  request: NextRequest,
  handler: (event: WorkspaceAddOnEvent, diagnostics: WorkspaceAddOnDiagnostics) => Promise<NextResponse>,
) {
  const requestId = workspaceAddOnRequestId(request.headers.get("x-request-id"));
  const route = request.nextUrl.pathname;
  let stage: WorkspaceAddOnVerificationStage = "event_parse";
  const diagnostics: WorkspaceAddOnDiagnostics = {
    requestId,
    route,
    stage,
    setStage(nextStage) {
      stage = nextStage;
      diagnostics.stage = nextStage;
    },
  };
  try {
    const event = await readWorkspaceAddOnEvent(request);
    diagnostics.setStage("system_token_verification");
    await verifyWorkspaceAddOnRequest(request, event);
    diagnostics.setStage("handler");
    const response = await handler(event, diagnostics);
    diagnostics.setStage("response");
    response.headers.set("x-beckett-request-id", requestId);
    console.info("Google Workspace add-on request completed", workspaceAddOnLogRecord({
      route,
      requestId,
      stage: diagnostics.stage,
      status: response.status,
      responseType: "render_action",
      event: "request_completed",
    }));
    return response;
  } catch (error) {
    const errorCode = workspaceAddOnErrorCode(error);
    const status = workspaceAddOnErrorStatus(errorCode, diagnostics.stage);
    console.error("Google Workspace add-on request failed", workspaceAddOnLogRecord({
      route,
      requestId,
      stage: diagnostics.stage,
      status,
      responseType: "json_error",
      event: "request_failed",
      errorCode,
    }));
    const response = NextResponse.json(
      { error: status === 503 ? "addon_configuration_error" : status === 401 ? "unauthorized_addon_request" : "workspace_addon_error", requestId },
      { status },
    );
    response.headers.set("x-beckett-request-id", requestId);
    return response;
  }
}
