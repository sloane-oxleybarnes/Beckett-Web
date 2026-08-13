import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/server-auth";
import { metering } from "@/lib/metering";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getAuthenticatedContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await metering.web.report(user.id));
}
