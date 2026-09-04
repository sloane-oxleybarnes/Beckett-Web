import { metering } from "@/lib/metering";
import { WEB_CREDITS_ENABLED } from "@/lib/web-credits";

type AiMeteringInput = {
  userId: string;
  source: string;
  action: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  metered?: boolean;
};

/**
 * Runs one AI operation behind the shared credit boundary. Web credits are held
 * atomically and charged only after a successful provider response.
 */
export async function withAiMetering<T>(
  input: AiMeteringInput,
  execute: () => Promise<T>,
): Promise<T> {
  if (input.metered === false) return execute();

  if (!WEB_CREDITS_ENABLED) {
    await metering.ai.record({
      userId: input.userId,
      source: input.source,
      action: input.action,
      metadata: input.metadata,
    });
    return execute();
  }

  const reservation = await metering.web.reserve({
    userId: input.userId,
    requestId: input.requestId || crypto.randomUUID(),
    source: input.source,
    action: input.action,
    metadata: input.metadata,
  });

  try {
    const result = await execute();
    if (reservation) await metering.web.commit(reservation, undefined);
    return result;
  } catch (error) {
    if (reservation) await metering.web.release(reservation).catch(() => undefined);
    throw error;
  }
}
