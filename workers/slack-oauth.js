// Beckett Slack OAuth exchanger.
// Required secrets: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET.
// Configuration: ALLOWED_ORIGINS and SLACK_REDIRECT_URIS (comma-separated).

const BOT_SCOPES = "commands,chat:write,assistant:write,im:history,im:write,users:read";
const DEFAULT_ORIGINS = ["https://meetbeckett.co", "https://www.meetbeckett.co"];
const DEFAULT_REDIRECTS = ["https://www.meetbeckett.co/api/slack/callback"];

function configuredList(value, defaults) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : defaults;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = configuredList(env.ALLOWED_ORIGINS, DEFAULT_ORIGINS);
  return {
    ...(allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env) },
  });
}

function validRedirect(value, env) {
  return configuredList(env.SLACK_REDIRECT_URIS, DEFAULT_REDIRECTS).includes(value);
}

function normalizedOAuthResult(data) {
  return {
    ok: true,
    access_token: data.access_token || null,
    refresh_token: data.refresh_token || null,
    expires_in: data.expires_in || null,
    scope: data.scope || "",
    token_type: data.token_type || "bot",
    bot_user_id: data.bot_user_id || null,
    app_id: data.app_id || null,
    team: data.team ? { id: data.team.id || null, name: data.team.name || null } : null,
    enterprise: data.enterprise ? { id: data.enterprise.id || null, name: data.enterprise.name || null } : null,
    authed_user: data.authed_user ? { id: data.authed_user.id || null } : null,
  };
}

const worker = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin") || "";
      if (!configuredList(env.ALLOWED_ORIGINS, DEFAULT_ORIGINS).includes(origin)) {
        return json(request, env, { error: "Origin not allowed" }, 403);
      }
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.endsWith("/auth-url")) {
      const redirectUri = url.searchParams.get("redirect_uri") || "";
      const state = url.searchParams.get("state") || "";
      if (!env.SLACK_CLIENT_ID) return json(request, env, { error: "Slack client ID not configured" }, 500);
      if (!validRedirect(redirectUri, env)) return json(request, env, { error: "Redirect URI not allowed" }, 400);
      if (!state) return json(request, env, { error: "OAuth state required" }, 400);

      const authUrl = `https://slack.com/oauth/v2/authorize?${new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        scope: BOT_SCOPES,
        redirect_uri: redirectUri,
        state,
      }).toString()}`;
      return json(request, env, { auth_url: authUrl });
    }

    if (request.method !== "POST") return json(request, env, { error: "Method not allowed" }, 405);

    let body;
    try {
      body = await request.json();
    } catch {
      return json(request, env, { error: "Invalid JSON" }, 400);
    }

    const redirectUri = String(body.redirect_uri || "");
    if (!validRedirect(redirectUri, env)) return json(request, env, { error: "Redirect URI not allowed" }, 400);

    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
    });
    if (body.refresh_token) {
      params.set("grant_type", "refresh_token");
      params.set("refresh_token", body.refresh_token);
    } else if (body.code) {
      params.set("code", body.code);
      params.set("redirect_uri", redirectUri);
    } else {
      return json(request, env, { error: "Authorization code or refresh token required" }, 400);
    }

    const slackResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const slackData = await slackResponse.json();
    if (!slackData.ok) {
      return json(request, env, { ok: false, error: slackData.error || "Slack auth failed" }, 400);
    }
    return json(request, env, normalizedOAuthResult(slackData));
  },
};

export default worker;
