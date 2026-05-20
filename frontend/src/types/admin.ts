import type { Json } from "../lib/supabase.types";
import type { SupportedLanguage } from "../utils/types";

export interface AdminRole {
  id: string;
  name: string;
  label: string;
  description: string | null;
  createdAt: string;
}

export interface AdminPermission {
  id: string;
  role: string;
  permission: string;
  description: string | null;
  createdAt: string;
}

export interface UserActivityRecord {
  id: string;
  userId: string | null;
  action: string;
  language: SupportedLanguage | null;
  metadata: Json;
  createdAt: string;
}

export interface ExecutionLogRecord {
  id: string;
  userId: string | null;
  language: SupportedLanguage;
  codeLength: number;
  executionTime: number;
  compileTime: number;
  traceTime: number;
  success: boolean;
  errorMessage: string | null;
  errorType: string | null;
  runtimeStatus: string;
  codePreview: string | null;
  metadata: Json;
  createdAt: string;
}

export interface VisualizationSessionRecord {
  id: string;
  userId: string | null;
  totalSteps: number;
  playbackDuration: number;
  language: SupportedLanguage;
  metadata: Json;
  createdAt: string;
}

export interface FeedbackReportRecord {
  id: string;
  userId: string | null;
  message: string;
  type: string;
  status: "open" | "in_review" | "resolved";
  adminNotes: string | null;
  metadata: Json;
  createdAt: string;
  updatedAt: string;
}

export interface CrashReportRecord {
  id: string;
  userId: string | null;
  language: SupportedLanguage | null;
  stackTrace: string | null;
  errorMessage: string;
  severity: "info" | "warning" | "error" | "critical";
  metadata: Json;
  createdAt: string;
}

export interface AdminOverviewMetrics {
  totalUsers: number;
  activeUsersToday: number;
  activeUsersOnline: number;
  totalExecutions: number;
  successRate: number;
  runtimeFailureRate: number;
  visualizationCount: number;
  mostActiveLanguage: SupportedLanguage | "none";
  feedbackSubmissions: number;
  crashReports: number;
  retentionRate: number;
}

export interface ChartPoint {
  label: string;
  date: string;
  value: number;
  secondaryValue?: number;
}

export interface LanguageBreakdown {
  language: SupportedLanguage;
  total: number;
  successful: number;
  failed: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  lastSeenAt: string;
  isAdmin: boolean;
  role: string;
  totalExecutions: number;
  lastActive: string | null;
  mostUsedLanguage: SupportedLanguage | "none";
  activeToday: boolean;
  online: boolean;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  tone: "info" | "warning" | "error" | "success";
  createdAt: string;
}

export interface SystemHealthSnapshot {
  backendConnection: "checking" | "online" | "offline";
  executorMode: "local" | "remote";
  executionProvider: string;
  runtimeInstalledCount: number;
  runtimeMissingCount: number;
  rendererOnline: boolean;
}
