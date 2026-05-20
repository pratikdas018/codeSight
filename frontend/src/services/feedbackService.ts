import type { SupportedLanguage } from "../utils/types";
import { submitFeedbackReport } from "./analyticsService";

export const feedbackCategories = [
  "bug_report",
  "feature_request",
  "ui_feedback",
  "visualization_issue",
  "runtime_issue",
  "general_suggestion",
] as const;

export type FeedbackCategory = (typeof feedbackCategories)[number];

export const feedbackCategoryLabels: Record<FeedbackCategory, string> = {
  bug_report: "Bug report",
  feature_request: "Feature request",
  ui_feedback: "UI feedback",
  visualization_issue: "Visualization issue",
  runtime_issue: "Runtime issue",
  general_suggestion: "General suggestion",
};

export interface FeedbackContext {
  appVersion: string;
  currentLine: number | null;
  environment: "desktop" | "web";
  language: SupportedLanguage;
  stepCount: number;
  traceStatus: string;
  userId?: string | null;
}

export interface FeedbackDraft {
  category: FeedbackCategory;
  context: FeedbackContext;
  email: string;
  message: string;
}

export const saveFeedbackRecord = async (
  draft: FeedbackDraft & { userId?: string | null },
) => submitFeedbackReport(draft);
