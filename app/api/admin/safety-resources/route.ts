import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSafetyResourceCatalogForReview, SAFETY_RESOURCE_OWNER, SAFETY_RESOURCE_REVIEW_CADENCE_DAYS } from "@/lib/safety-resources";

export const dynamic = "force-dynamic";

export async function GET() {
  if (cookies().get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resources = getSafetyResourceCatalogForReview();
  return NextResponse.json({
    owner: SAFETY_RESOURCE_OWNER,
    reviewCadenceDays: SAFETY_RESOURCE_REVIEW_CADENCE_DAYS,
    generatedAt: new Date().toISOString(),
    resources,
  });
}
