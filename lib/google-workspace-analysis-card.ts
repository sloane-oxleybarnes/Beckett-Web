import type { NextRequest } from "next/server";
import {
  actionFixedFooter,
  brandedSectionHeader,
  endpointUrl,
  formatCardRichText,
  textWidget,
  type Card,
} from "@/lib/google-workspace-addon";

export type WorkspaceAnalysisSections = {
  happening: string;
  tone: string;
  want: string;
};

function sectionLines(value: string, fallback: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[•*-]\s*/, ""))
    .filter(Boolean);

  return lines.length ? lines : [fallback];
}

function analysisSection(header: string, value: string, fallback: string) {
  const [bottomLine, ...details] = sectionLines(value, fallback);
  const detailText = details.length
    ? details.map((line) => `- ${line}`).join("\n")
    : "- No additional detail is visible in this conversation.";

  return {
    header: brandedSectionHeader(header),
    collapsible: true,
    uncollapsibleWidgetsCount: 1,
    widgets: [
      textWidget(`<b>Bottom line</b><br>${formatCardRichText(bottomLine)}`),
      textWidget(`<b>Details</b><br>${formatCardRichText(detailText)}`),
    ],
  };
}

export function buildWorkspaceAnalysisCard(
  request: NextRequest,
  sections: WorkspaceAnalysisSections,
): Card {
  return {
    name: "beckett-analysis-result",
    sections: [
      analysisSection(
        "What's happening",
        sections.happening,
        "The visible conversation does not establish a clear change or decision.",
      ),
      analysisSection(
        "Tone",
        sections.tone,
        "The visible wording does not establish a clear emotional tone.",
      ),
      analysisSection(
        "What they want",
        sections.want,
        "No explicit next step is visible in the selected conversation.",
      ),
    ],
    fixedFooter: actionFixedFooter(
      "Help me reply",
      endpointUrl(request, "/api/google-workspace-addon/reply"),
    ),
  };
}

export function normalizeWorkspaceAnalysisSections(value: unknown): WorkspaceAnalysisSections | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.happening !== "string" ||
    typeof record.tone !== "string" ||
    typeof record.want !== "string"
  ) {
    return null;
  }

  return {
    happening: record.happening.slice(0, 4_000),
    tone: record.tone.slice(0, 4_000),
    want: record.want.slice(0, 4_000),
  };
}
