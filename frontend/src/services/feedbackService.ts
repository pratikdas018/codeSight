import type { SupportedLanguage } from "../utils/types";

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

export interface FeedbackRecord extends FeedbackDraft {
  createdAt: string;
  id: string;
}

const FEEDBACK_STORAGE_KEY = "codesight-feedback";
const MAX_FEEDBACK_RECORDS = 50;

const parseFeedbackRecords = (value: string | null): FeedbackRecord[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as FeedbackRecord[]) : [];
  } catch {
    return [];
  }
};

export const listFeedbackRecords = (): FeedbackRecord[] => {
  if (typeof window === "undefined") {
    return [];
  }

  return parseFeedbackRecords(window.localStorage.getItem(FEEDBACK_STORAGE_KEY));
};

export const saveFeedbackRecord = (draft: FeedbackDraft) => {
  if (typeof window === "undefined") {
    throw new Error("Feedback storage is only available in the renderer.");
  }

  const nextRecord: FeedbackRecord = {
    ...draft,
    createdAt: new Date().toISOString(),
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };

  const existingRecords = listFeedbackRecords();
  const nextRecords = [nextRecord, ...existingRecords].slice(
    0,
    MAX_FEEDBACK_RECORDS,
  );

  window.localStorage.setItem(
    FEEDBACK_STORAGE_KEY,
    JSON.stringify(nextRecords),
  );

  return nextRecord;
};
