import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSafetyResourceCatalogForReview,
  SAFETY_RESOURCE_OWNER,
  SAFETY_RESOURCE_REVIEW_CADENCE_DAYS,
} from "@/lib/safety-resources";
import { verifyAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!verifyAdminSession(cookies().get("admin_auth")?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    owner: SAFETY_RESOURCE_OWNER,
    reviewCadenceDays: SAFETY_RESOURCE_REVIEW_CADENCE_DAYS,
    generatedAt: new Date().toISOString(),
    resources: getSafetyResourceCatalogForReview(),
  });
}
