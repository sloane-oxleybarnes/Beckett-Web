export type CoursePhase = "confidence-start" | "slides" | "guided-practice" | "open-practice-intro" | "open-practice" | "debrief" | "confidence-end" | "completion" | "review";

export type CourseMessage = { role: "user" | "assistant"; content: string; timestamp?: string };
export type CourseApiError = Error & { status?: number; data?: { error?: string; limit?: number; remaining?: number } };
export type CourseActivityState = { completedSlides?: Record<string, true> };
export type CourseProgressRow = {
  phase: CoursePhase;
  current_slide_index: number | null;
  pre_confidence: number | null;
  progress_percent: number | null;
  saved_at: string | null;
  activity_state: CourseActivityState | null;
};
export type ReviewBlock = { heading?: string; lines: string[] };
export type WrongAnswer = {
  slideIndex: number;
  itemIndex: number;
  slideTitle: string;
  scenario: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
};
export type DebriefData = { other_person_felt: string; how_you_came_across: string; what_went_well: string; things_to_work_on: string };
export type ToolkitItem = {
  id: string;
  course_id: string;
  category: string;
  label: string;
  content: string;
  created_at: string;
  updated_at?: string;
};

export const PAIR_COLORS = [
  { bg: "bg-sky-100", border: "border-sky-400", text: "text-sky-700" },
  { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700" },
  { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-700" },
  { bg: "bg-violet-100", border: "border-violet-400", text: "text-violet-700" },
  { bg: "bg-rose-100", border: "border-rose-400", text: "text-rose-700" },
];

export const CLARITY_FORMULA_STEPS = ["What I understand", "What is unclear", "Specific question", "Why it helps"];
export const INTRO_FORMULA_STEPS = ["Who you are", "What you do", "How you collaborate"];
export const DATING_FORMULA_STEPS = ["Warm signal", "Specific plan", "Easy out"];

export async function callCourseApi(body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { error?: string; limit?: number; remaining?: number };
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : "Beckett could not complete that request.";
    const error = new Error(message) as CourseApiError;
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
