import { cache } from "react";
import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getExtensionUserId } from "@/lib/extension-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export class AuthenticationError extends Error {
  readonly status = 401;

  constructor() {
    super("Unauthorized");
  }
}

/**
 * Returns a server-verified user and the cookie-aware client that verified it.
 * React cache deduplicates repeated auth lookups within one server render.
 */
export const getAuthenticatedContext = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user: error ? null : user };
});

export async function requireUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: User;
}> {
  const context = await getAuthenticatedContext();
  if (!context.user) throw new AuthenticationError();
  return { ...context, user: context.user };
}

/** Resolve browser-cookie or extension-token identity at the API boundary. */
export async function getRequestUserId(
  request: NextRequest,
  options: { allowExtension?: boolean } = {},
): Promise<string | null> {
  if (options.allowExtension) {
    const extensionUserId = await getExtensionUserId(request);
    if (extensionUserId) return extensionUserId;
  }

  const { user } = await getAuthenticatedContext();
  return user?.id ?? null;
}
