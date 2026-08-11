import { recordAiUsage } from "@/lib/ai-usage";
import {
  WEB_CREDITS_ENABLED,
  commitWebCredit,
  releaseWebCredit,
  reserveWebCredit,
} from "@/lib/web-credits";

type AiMeteringInput = {
  userId: string;
  source: string;
  action: string;
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
    await recordAiUsage(input.userId, {
      source: input.source,
      action: input.action,
      metadata: input.metadata,
    });
    return execute();
  }

  const reservation = await reserveWebCredit(input.userId, {
    requestId: crypto.randomUUID(),
    source: input.source,
    action: input.action,
    metadata: input.metadata,
  });

  try {
    const result = await execute();
    if (reservation) await commitWebCredit(reservation.id);
    return result;
  } catch (error) {
    if (reservation) await releaseWebCredit(reservation.id).catch(() => undefined);
    throw error;
  }
}
