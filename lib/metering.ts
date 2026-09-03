import {
  commitSlackCredit,
  getSlackCreditSummary,
  releaseSlackCredit,
  reserveSlackCredit,
} from "@/lib/slack-credits";
import {
  commitWebCredit,
  getWebCreditSummary,
  releaseWebCredit,
  reserveWebCredit,
} from "@/lib/web-credits";
import { getAiUsageSummary, recordAiUsage } from "@/lib/ai-usage";
import type {
  AiUsageReporter,
  MeteringAdapter,
} from "@/lib/metering-contract";

export type WebMeteringInput = {
  userId: string;
  requestId: string;
  source: string;
  action: string;
  metadata?: Record<string, unknown>;
};

export type SlackMeteringInput = {
  requestId: string;
  teamId: string;
  slackUserId: string;
  beckettUserId?: string | null;
};

export type SlackCommitInput = {
  eventType: string;
  flowType: string;
};

export type SlackReportInput = {
  teamId: string;
  slackUserId: string;
  beckettUserId?: string | null;
};

const webAdapter: MeteringAdapter<
  WebMeteringInput,
  undefined,
  string,
  Awaited<ReturnType<typeof getWebCreditSummary>>
> = {
  async reserve(input) {
    const reservation = await reserveWebCredit(input.userId, input);
    return reservation ? { ...reservation, provider: "web" } : null;
  },
  async commit(reservation) {
    await commitWebCredit(reservation.id);
  },
  async release(reservation) {
    await releaseWebCredit(reservation.id);
  },
  report: getWebCreditSummary,
};

const slackAdapter: MeteringAdapter<
  SlackMeteringInput,
  SlackCommitInput,
  SlackReportInput,
  Awaited<ReturnType<typeof getSlackCreditSummary>>
> = {
  async reserve(input) {
    const reservation = await reserveSlackCredit(input);
    return { ...reservation, provider: "slack" };
  },
  async commit(reservation, input) {
    await commitSlackCredit(reservation.id, input.eventType, input.flowType);
  },
  async release(reservation) {
    await releaseSlackCredit(reservation.id);
  },
  report: getSlackCreditSummary,
};

const aiUsageReporter: AiUsageReporter = {
  record(input) {
    return recordAiUsage(input.userId, input);
  },
  report(input) {
    return getAiUsageSummary(input.userId, input.source);
  },
};

export const metering = {
  web: webAdapter,
  slack: slackAdapter,
  ai: aiUsageReporter,
};

export type Metering = typeof metering;
