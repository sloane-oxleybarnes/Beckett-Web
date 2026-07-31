import { createHash } from "crypto";

type Bucket = { count: number; resetAt: number };

// Vercel functions are short-lived, so this is deliberately a bounded,
// best-effort guard. Sensitive endpoints also have provider-side limits.
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export function hashRateLimitKey(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function requestAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  for (const [bucketKey, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: bucket.resetAt };
  }

  current.count += 1;
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

export function rateLimitResponse(result: ReturnType<typeof enforceRateLimit>) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}

export async function readJsonWithLimit<T>(request: Request, maxBytes: number): Promise<T | null> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) return null;

  // Do not rely on Content-Length: chunked requests can omit it. Read at most
  // maxBytes + 1 bytes so malformed clients cannot force an unbounded body into
  // memory before validation.
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const body = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}
