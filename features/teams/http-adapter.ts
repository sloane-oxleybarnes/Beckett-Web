import type {
  HttpMethod,
  HttpRouteHandler,
  IHttpServerAdapter,
  IHttpServerResponse,
} from "@microsoft/teams.apps";

export class NextTeamsHttpAdapter implements IHttpServerAdapter {
  private routes = new Map<string, HttpRouteHandler>();

  registerRoute(method: HttpMethod, path: string, handler: HttpRouteHandler) {
    this.routes.set(`${method} ${path}`, handler);
  }

  async handle(method: HttpMethod, path: string, body: unknown, headers: Record<string, string>): Promise<IHttpServerResponse> {
    const handler = this.routes.get(`${method} ${path}`);
    if (!handler) return { status: 404, body: { error: "Teams endpoint not initialized" } };
    return handler({ body, headers });
  }
}
