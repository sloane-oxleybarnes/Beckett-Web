import { NextResponse } from "next/server";
import { getSiteContent } from "@/lib/site-content-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const content = await getSiteContent();
  return NextResponse.json({ content });
}
