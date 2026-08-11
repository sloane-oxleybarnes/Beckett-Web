import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { trackBetaEvent } from "@/lib/beta-events";
import { sendFeedbackThankYouIfFirst } from "@/lib/beta-emails";

type DashboardFeedbackBody = {
  rating?: "yes" | "no";
  comment?: string;
  page?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

const SCREENSHOT_BUCKET = "feedback-screenshots";
const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

async function removeUploadedScreenshots(items: Array<{ path: string }>) {
  if (!items.length) return;
  const { error } = await supabaseAdmin.storage
    .from(SCREENSHOT_BUCKET)
    .remove(items.map((item) => item.path));
  if (error) console.error("Feedback screenshot cleanup failed", error);
}

function truncate(value: unknown, max = 4000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

function parseMetadata(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";
  const formData = contentType.includes("multipart/form-data") ? await req.formData() : null;
  const body = formData
    ? {
        rating: formData.get("rating") || undefined,
        comment: formData.get("comment") || undefined,
        page: formData.get("page") || undefined,
        source: formData.get("source") || undefined,
        metadata: parseMetadata(formData.get("metadata")),
      }
    : ((await req.json().catch(() => ({}))) as DashboardFeedbackBody);
  if (body.rating !== "yes" && body.rating !== "no") {
    return NextResponse.json({ error: "rating must be yes or no" }, { status: 400 });
  }

  const page = truncate(body.page, 300);
  const source = truncate(body.source || "dashboard", 100) || "dashboard";
  const screenshots = formData?.getAll("screenshots").filter((item): item is File => item instanceof File) || [];

  if (screenshots.length > MAX_SCREENSHOTS) {
    return NextResponse.json({ error: `Attach up to ${MAX_SCREENSHOTS} screenshots.` }, { status: 400 });
  }
  if (screenshots.some((file) => !IMAGE_TYPES.has(file.type) || file.size > MAX_SCREENSHOT_BYTES)) {
    return NextResponse.json({ error: "Screenshots must be PNG, JPG, or WebP images smaller than 10 MB." }, { status: 400 });
  }

  const uploadedScreenshots: Array<{ path: string; name: string; type: string; size: number }> = [];
  for (const file of screenshots) {
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(SCREENSHOT_BUCKET).upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      await removeUploadedScreenshots(uploadedScreenshots);
      return NextResponse.json({ error: "Could not upload the screenshot. Please try again." }, { status: 500 });
    }
    uploadedScreenshots.push({ path, name: truncate(file.name, 180) || "screenshot", type: file.type, size: file.size });
  }

  const { error } = await supabaseAdmin.from("beta_feedback").insert({
    user_id: user.id,
    rating: body.rating,
    comment: truncate(body.comment),
    platform: "web",
    mode: page,
    source,
    response_text: null,
    analysis_result: {},
    context_snapshot: {},
    metadata: {
      ...(body.metadata || {}),
      page,
      screenshots: uploadedScreenshots,
    },
  });

  if (error) {
    await removeUploadedScreenshots(uploadedScreenshots);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await trackBetaEvent({
    userId: user.id,
    email: user.email,
    eventName: "feedback_submitted",
    source,
    metadata: {
      rating: body.rating,
      page,
    },
  });

  await sendFeedbackThankYouIfFirst({
    userId: user.id,
    email: user.email,
  });

  return NextResponse.json({ ok: true });
}
