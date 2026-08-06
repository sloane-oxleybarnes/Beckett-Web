import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server-admin";
import { WEB_CREDITS_ENABLED } from "@/lib/web-credits";

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
};

export type Card = {
  name?: string;
  header?: { title: string; subtitle?: string; imageUrl?: string; imageType?: "CIRCLE" | "SQUARE" };
  sections: Array<{
    header?: string;
    collapsible?: boolean;
    widgets: Array<Record<string, unknown>>;
  }>;
  fixedFooter?: Record<string, unknown>;
  displayStyle?: "PEEK" | "REPLACE";
  peekCardHeader?: { title: string; subtitle?: string };
};

const googleAuth = new OAuth2Client();

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

async function verifyWorkspaceUser(event: WorkspaceAddOnEvent): Promise<TokenPayload> {
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

export async function resolveWorkspaceAddOnProfile(event: WorkspaceAddOnEvent): Promise<WorkspaceAddOnProfile | null> {
  const user = await verifyWorkspaceUser(event);
  const googleSubject = user.sub;
  const email = user.email!.trim().toLowerCase();

  const { data: mappedIntegration } = await supabaseAdmin
    .from("user_integrations")
    .select("user_id")
    .eq("provider", "google_workspace_addon")
    .eq("external_user_id", googleSubject)
    .maybeSingle();

  let userId = mappedIntegration?.user_id || null;
  if (!userId) {
    const { data: profileByEmail } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    userId = profileByEmail?.id || null;
  }
  if (!userId) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id,email,plan")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  if (!mappedIntegration) {
    const now = new Date().toISOString();
    await supabaseAdmin.from("user_integrations").upsert(
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

  return { ...profile, googleSubject };
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

export function textWidget(text: string) {
  return { textParagraph: { text } };
}

export function decoratedTextWidget(topLabel: string, text: string) {
  return { decoratedText: { topLabel, text } };
}

export function buttonWidget(text: string, functionUrl: string, parameters?: Record<string, string>) {
  return {
    buttonList: {
      buttons: [
        {
          text,
          color: { red: 0.729, green: 0.459, blue: 0.09 },
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

export function openLinkButtonWidget(text: string, url: string) {
  return {
    buttonList: {
      buttons: [
        {
          text,
          color: { red: 0.729, green: 0.459, blue: 0.09 },
          onClick: { openLink: { url, onClose: "RELOAD", openAs: "OVERLAY" } },
        },
      ],
    },
  };
}

export function cardResponse(card: Card, stateChanged = false) {
  return NextResponse.json({
    ...(stateChanged ? { stateChanged: true } : {}),
    renderActions: { action: { navigations: [{ pushCard: card }] } },
  });
}

export function errorCard(title: string, message: string): Card {
  return {
    header: { title: "Beckett", subtitle: title },
    sections: [{ widgets: [textWidget(formatCardText(message))] }],
  };
}

export function signInCard(request: NextRequest): Card {
  const signInUrl = endpointUrl(request, "/auth/login?next=%2Fdashboard");
  return {
    header: { title: "Connect Beckett", subtitle: "Private communication coaching" },
    sections: [
      {
        widgets: [
          textWidget("Sign in to your Beckett account to analyze the Gmail message you choose."),
          textWidget("Beckett only receives message content after you select an analysis action."),
          openLinkButtonWidget("Sign in to Beckett", signInUrl),
        ],
      },
    ],
  };
}

export async function workspaceAddOnRoute(
  request: NextRequest,
  handler: (event: WorkspaceAddOnEvent) => Promise<NextResponse>,
) {
  try {
    const event = await readWorkspaceAddOnEvent(request);
    await verifyWorkspaceAddOnRequest(request, event);
    return await handler(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "workspace_addon_error";
    const configurationError = /not configured/.test(message);
    console.error("Google Workspace add-on request failed", { message });
    return NextResponse.json(
      { error: configurationError ? message : "unauthorized_addon_request" },
      { status: configurationError ? 503 : 401 },
    );
  }
}
