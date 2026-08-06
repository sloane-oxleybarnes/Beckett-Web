const AUTH_BASE_URL = "https://beckett.invalid";

export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  try {
    const parsed = new URL(value, AUTH_BASE_URL);
    if (parsed.origin !== AUTH_BASE_URL) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function profileSetupPath(next: string | null | undefined): string {
  const safeNext = safeInternalPath(next);
  return safeNext
    ? `/auth/profile-setup?next=${encodeURIComponent(safeNext)}`
    : "/auth/profile-setup";
}
