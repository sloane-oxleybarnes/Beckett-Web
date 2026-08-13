export type MeteringReservationStatus = "reserved" | "committed" | "released";

export type MeteringReservation = {
  id: string;
  status: MeteringReservationStatus;
  provider: "web" | "slack";
};

export type MeteringAdapter<ReserveInput, CommitInput, ReportInput, ReportOutput> = {
  reserve(input: ReserveInput): Promise<MeteringReservation | null>;
  commit(reservation: MeteringReservation, input: CommitInput): Promise<void>;
  release(reservation: MeteringReservation): Promise<void>;
  report(input: ReportInput): Promise<ReportOutput>;
};

export type AiUsageReportInput = {
  userId: string;
  source: string;
  action: string;
  tokenEstimate?: number;
  metadata?: Record<string, unknown>;
};

export type AiUsageReporter = {
  record(input: AiUsageReportInput): ReturnType<typeof import("@/lib/ai-usage").recordAiUsage>;
  report(input: { userId: string; source?: string }): ReturnType<typeof import("@/lib/ai-usage").getAiUsageSummary>;
};
