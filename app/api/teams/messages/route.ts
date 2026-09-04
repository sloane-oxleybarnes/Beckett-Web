import { NextRequest, NextResponse } from "next/server";
import { handleTeamsHttpRequest } from "@/features/teams/app";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const headers = Object.fromEntries(request.headers.entries());
  const response = await handleTeamsHttpRequest(body, headers);
  return NextResponse.json(response.body ?? {}, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
