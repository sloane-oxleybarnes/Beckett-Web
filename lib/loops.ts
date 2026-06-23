import { LoopsClient } from "loops";
import { canSendLifecycleMessages, lifecycleMessagesDisabledReason } from "./deployment-env";

function getClient() {
  const key = process.env.LOOPS_API_KEY;
  if (!key) throw new Error("LOOPS_API_KEY is not set");
  return new LoopsClient(key);
}

export async function addLoopsContact(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  plan?: string;
  source?: string;
}) {
  if (!canSendLifecycleMessages()) {
    console.warn(`Skipped Loops contact sync for ${params.email}. ${lifecycleMessagesDisabledReason()}`);
    return;
  }

  try {
    await getClient().createContact({
      email: params.email,
      properties: {
        firstName: params.firstName || "",
        lastName: params.lastName || "",
        plan: params.plan || "free",
        source: params.source || "website",
        userGroup: params.plan || "free",
      },
    });
  } catch (err) {
    console.error("Loops createContact error:", err);
  }
}

export async function updateLoopsContact(
  email: string,
  properties: Record<string, string | boolean>
) {
  if (!canSendLifecycleMessages()) {
    console.warn(`Skipped Loops contact update for ${email}. ${lifecycleMessagesDisabledReason()}`);
    return;
  }

  try {
    await getClient().updateContact({ email, properties });
  } catch (err) {
    console.error("Loops updateContact error:", err);
  }
}

export async function triggerLoopsEvent(
  email: string,
  eventName: string,
  properties?: Record<string, string>
) {
  if (!canSendLifecycleMessages()) {
    console.warn(`Skipped Loops event ${eventName} for ${email}. ${lifecycleMessagesDisabledReason()}`);
    return;
  }

  try {
    await getClient().sendEvent({
      email,
      eventName,
      eventProperties: properties,
    });
  } catch (err) {
    console.error("Loops event error:", err);
  }
}
