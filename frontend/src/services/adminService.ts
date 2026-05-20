import { requireSupabase } from "../lib/supabase";
import type {
  AdminNotification,
  AdminOverviewMetrics,
  AdminUserRow,
  ChartPoint,
  CrashReportRecord,
  ExecutionLogRecord,
  FeedbackReportRecord,
  LanguageBreakdown,
  SystemHealthSnapshot,
  UserActivityRecord,
  VisualizationSessionRecord,
} from "../types/admin";
import type { RuntimeHealthPayload } from "../utils/api";
import { fetchRuntimeHealth } from "../utils/api";
import type { SupportedLanguage } from "../utils/types";

const LANGUAGE_VALUES: SupportedLanguage[] = ["javascript", "python", "c", "cpp", "java"];

const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
};

const startOfDaysAgoUtc = (days: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days)).toISOString();
};

const mapExecution = (row: any): ExecutionLogRecord => ({
  id: row.id,
  userId: row.user_id,
  language: row.language,
  codeLength: row.code_length,
  executionTime: row.execution_time,
  compileTime: row.compile_time,
  traceTime: row.trace_time,
  success: row.success,
  errorMessage: row.error_message,
  errorType: row.error_type,
  runtimeStatus: row.runtime_status,
  codePreview: row.code_preview,
  metadata: row.metadata,
  createdAt: row.created_at,
});

const mapVisualization = (row: any): VisualizationSessionRecord => ({
  id: row.id,
  userId: row.user_id,
  totalSteps: row.total_steps,
  playbackDuration: row.playback_duration,
  language: row.language,
  metadata: row.metadata,
  createdAt: row.created_at,
});

const mapFeedback = (row: any): FeedbackReportRecord => ({
  id: row.id,
  userId: row.user_id,
  message: row.message,
  type: row.type,
  status: row.status,
  adminNotes: row.admin_notes,
  metadata: row.metadata,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapCrash = (row: any): CrashReportRecord => ({
  id: row.id,
  userId: row.user_id,
  language: row.language,
  stackTrace: row.stack_trace,
  errorMessage: row.error_message,
  severity: row.severity,
  metadata: row.metadata,
  createdAt: row.created_at,
});

const mapActivity = (row: any): UserActivityRecord => ({
  id: row.id,
  userId: row.user_id,
  action: row.action,
  language: row.language,
  metadata: row.metadata,
  createdAt: row.created_at,
});

const groupByDay = <T extends { createdAt: string }>(
  rows: T[],
  getValue: (row: T) => number = () => 1,
): ChartPoint[] => {
  const map = new Map<string, number>();

  for (const row of rows) {
    const date = row.createdAt.slice(0, 10);
    map.set(date, (map.get(date) ?? 0) + getValue(row));
  }

  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({
      date,
      label: new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      value,
    }));
};

const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;

export const fetchAdminOverviewMetrics = async (): Promise<AdminOverviewMetrics> => {
  const supabase = requireSupabase();
  const todayIso = startOfTodayUtc();
  const last7DaysIso = startOfDaysAgoUtc(7);
  const last30DaysIso = startOfDaysAgoUtc(30);

  const [
    profilesResponse,
    todayActivityResponse,
    onlineActivityResponse,
    executionResponse,
    visualizationResponse,
    feedbackResponse,
    crashResponse,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, created_at, last_seen_at", { count: "exact" }),
    supabase
      .from("user_activity")
      .select("user_id, created_at")
      .gte("created_at", todayIso),
    supabase
      .from("user_activity")
      .select("user_id, created_at")
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()),
    supabase
      .from("execution_logs")
      .select("id, language, success, created_at"),
    supabase
      .from("visualization_sessions")
      .select("id"),
    supabase
      .from("feedback_reports")
      .select("id"),
    supabase
      .from("crash_reports")
      .select("id"),
  ]);

  for (const response of [
    profilesResponse,
    todayActivityResponse,
    onlineActivityResponse,
    executionResponse,
    visualizationResponse,
    feedbackResponse,
    crashResponse,
  ]) {
    if (response.error) {
      throw new Error(response.error.message);
    }
  }

  const executions = executionResponse.data ?? [];
  const languageCounts = LANGUAGE_VALUES.reduce<Record<SupportedLanguage, number>>(
    (accumulator, language) => ({ ...accumulator, [language]: 0 }),
    {} as Record<SupportedLanguage, number>,
  );

  for (const execution of executions) {
    languageCounts[execution.language] += 1;
  }

  const mostActiveLanguage =
    Object.entries(languageCounts).sort((left, right) => right[1] - left[1])[0]?.[1] > 0
      ? (Object.entries(languageCounts).sort((left, right) => right[1] - left[1])[0][0] as SupportedLanguage)
      : "none";

  const activeTodayUsers = new Set((todayActivityResponse.data ?? []).map((item) => item.user_id).filter(Boolean));
  const onlineUsers = new Set((onlineActivityResponse.data ?? []).map((item) => item.user_id).filter(Boolean));
  const recentUsers = new Set(
    (todayActivityResponse.data ?? [])
      .filter((item) => item.created_at >= last7DaysIso)
      .map((item) => item.user_id)
      .filter(Boolean),
  );
  const retainedUsers = new Set(
    (todayActivityResponse.data ?? [])
      .filter((item) => item.created_at >= last30DaysIso)
      .map((item) => item.user_id)
      .filter(Boolean),
  );

  const successfulExecutions = executions.filter((entry) => entry.success).length;
  const failedExecutions = executions.length - successfulExecutions;

  return {
    totalUsers: profilesResponse.count ?? 0,
    activeUsersToday: activeTodayUsers.size,
    activeUsersOnline: onlineUsers.size,
    totalExecutions: executions.length,
    successRate: ratio(successfulExecutions, executions.length),
    runtimeFailureRate: ratio(failedExecutions, executions.length),
    visualizationCount: visualizationResponse.data?.length ?? 0,
    mostActiveLanguage,
    feedbackSubmissions: feedbackResponse.data?.length ?? 0,
    crashReports: crashResponse.data?.length ?? 0,
    retentionRate: ratio(recentUsers.size, retainedUsers.size || (profilesResponse.count ?? 0)),
  };
};

export const fetchAnalyticsDataset = async () => {
  const supabase = requireSupabase();
  const sinceIso = startOfDaysAgoUtc(29);
  const [activityResponse, executionResponse, profilesResponse] = await Promise.all([
    supabase.from("user_activity").select("id, user_id, action, language, metadata, created_at").gte("created_at", sinceIso),
    supabase.from("execution_logs").select("*").gte("created_at", sinceIso),
    supabase.from("profiles").select("id, created_at"),
  ]);

  if (activityResponse.error || executionResponse.error || profilesResponse.error) {
    throw new Error(
      activityResponse.error?.message ||
        executionResponse.error?.message ||
        profilesResponse.error?.message ||
        "Unable to load analytics dataset.",
    );
  }

  const activities = (activityResponse.data ?? []).map(mapActivity);
  const executions = (executionResponse.data ?? []).map(mapExecution);
  const profiles = profilesResponse.data ?? [];
  const dailyActiveUsersMap = new Map<string, Set<string>>();

  for (const activity of activities) {
    const date = activity.createdAt.slice(0, 10);
    const bucket = dailyActiveUsersMap.get(date) ?? new Set<string>();
    if (activity.userId) {
      bucket.add(activity.userId);
    }
    dailyActiveUsersMap.set(date, bucket);
  }

  const dailyActiveUsers = [...dailyActiveUsersMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, users]) => ({
      date,
      label: new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      value: users.size,
    }));

  const executionTrends = groupByDay(executions);
  const executionSuccessVsFailure = executionTrends.map((point) => {
    const dayExecutions = executions.filter((entry) => entry.createdAt.slice(0, 10) === point.date);
    return {
      ...point,
      value: dayExecutions.filter((entry) => entry.success).length,
      secondaryValue: dayExecutions.filter((entry) => !entry.success).length,
    };
  });

  const languagePopularity = LANGUAGE_VALUES.map((language) => {
    const filtered = executions.filter((entry) => entry.language === language);
    return {
      language,
      total: filtered.length,
      successful: filtered.filter((entry) => entry.success).length,
      failed: filtered.filter((entry) => !entry.success).length,
    } satisfies LanguageBreakdown;
  });

  const growthMap = new Map<string, number>();
  for (const profile of profiles) {
    const date = profile.created_at.slice(0, 10);
    growthMap.set(date, (growthMap.get(date) ?? 0) + 1);
  }
  let cumulative = 0;
  const userGrowth = [...growthMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => {
      cumulative += count;
      return {
        date,
        label: new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        value: cumulative,
      };
    });

  return {
    dailyActiveUsers,
    executionTrends,
    executionSuccessVsFailure,
    languagePopularity,
    userGrowth,
  };
};

export const fetchAdminUsers = async (): Promise<AdminUserRow[]> => {
  const supabase = requireSupabase();
  const [profilesResponse, executionResponse, activityResponse] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name, created_at, last_seen_at, is_admin, role"),
    supabase.from("execution_logs").select("user_id, language, created_at"),
    supabase.from("user_activity").select("user_id, created_at"),
  ]);

  if (profilesResponse.error || executionResponse.error || activityResponse.error) {
    throw new Error(
      profilesResponse.error?.message ||
        executionResponse.error?.message ||
        activityResponse.error?.message ||
        "Unable to load users.",
    );
  }

  return (profilesResponse.data ?? []).map((profile) => {
    const executions = (executionResponse.data ?? []).filter((entry) => entry.user_id === profile.id);
    const activities = (activityResponse.data ?? []).filter((entry) => entry.user_id === profile.id);
    const languageTally = LANGUAGE_VALUES.map((language) => ({
      language,
      total: executions.filter((entry) => entry.language === language).length,
    })).sort((left, right) => right.total - left.total);
    const lastActive = activities[0]?.created_at ?? executions[0]?.created_at ?? null;

    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      createdAt: profile.created_at,
      lastSeenAt: profile.last_seen_at,
      isAdmin: profile.is_admin,
      role: profile.role,
      totalExecutions: executions.length,
      lastActive,
      mostUsedLanguage: languageTally[0]?.total ? languageTally[0].language : "none",
      activeToday: (lastActive ?? "").slice(0, 10) === startOfTodayUtc().slice(0, 10),
      online: new Date(profile.last_seen_at).getTime() >= Date.now() - 5 * 60 * 1000,
    };
  });
};

export const fetchRecentExecutionLogs = async () => {
  const { data, error } = await requireSupabase()
    .from("execution_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapExecution);
};

export const fetchVisualizationSessions = async () => {
  const { data, error } = await requireSupabase()
    .from("visualization_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapVisualization);
};

export const fetchCrashReports = async () => {
  const { data, error } = await requireSupabase()
    .from("crash_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapCrash);
};

export const fetchFeedbackReports = async () => {
  const { data, error } = await requireSupabase()
    .from("feedback_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapFeedback);
};

export const updateFeedbackReportStatus = async (payload: {
  id: string;
  status: FeedbackReportRecord["status"];
  adminNotes: string;
}) => {
  const { error } = await requireSupabase()
    .from("feedback_reports")
    .update({
      status: payload.status,
      admin_notes: payload.adminNotes,
    })
    .eq("id", payload.id);

  if (error) {
    throw new Error(error.message);
  }
};

export const fetchAdminNotifications = async (): Promise<AdminNotification[]> => {
  const [crashReports, feedbackReports, executionLogs] = await Promise.all([
    fetchCrashReports(),
    fetchFeedbackReports(),
    fetchRecentExecutionLogs(),
  ]);

  return [
    ...crashReports.slice(0, 3).map((report) => ({
      id: `crash-${report.id}`,
      title: "Crash captured",
      message: report.errorMessage,
      tone: (report.severity === "critical" ? "error" : "warning") as "error" | "warning",
      createdAt: report.createdAt,
    })),
    ...feedbackReports
      .filter((report) => report.status !== "resolved")
      .slice(0, 3)
      .map((report) => ({
        id: `feedback-${report.id}`,
        title: "Feedback needs review",
        message: report.message,
        tone: "info" as const,
        createdAt: report.createdAt,
      })),
    ...executionLogs
      .filter((entry) => !entry.success)
      .slice(0, 3)
      .map((entry) => ({
        id: `execution-${entry.id}`,
        title: "Execution failure",
        message: entry.errorMessage ?? `${entry.language} execution failed.`,
        tone: "warning" as const,
        createdAt: entry.createdAt,
      })),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6);
};

export const fetchSystemHealthSnapshot = async (): Promise<SystemHealthSnapshot> => {
  try {
    const health = (await fetchRuntimeHealth()) as RuntimeHealthPayload;
    return {
      backendConnection: "online",
      executorMode: health.executorMode,
      executionProvider: health.executionProvider,
      runtimeInstalledCount: health.runtimeManager.installedCount,
      runtimeMissingCount: health.runtimeManager.missingCount,
      rendererOnline: navigator.onLine,
    };
  } catch {
    return {
      backendConnection: "offline",
      executorMode: "local",
      executionProvider: "offline",
      runtimeInstalledCount: 0,
      runtimeMissingCount: 0,
      rendererOnline: navigator.onLine,
    };
  }
};

const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const exportRecords = <T extends object>(
  records: T[],
  format: "csv" | "json",
  fileName: string,
) => {
  const contents =
    format === "json"
      ? JSON.stringify(records, null, 2)
      : [
          Object.keys((records[0] ?? {}) as Record<string, unknown>).join(","),
          ...records.map((record) =>
            Object.values(record as Record<string, unknown>).map(escapeCsv).join(","),
          ),
        ].join("\n");
  const blob = new Blob([contents], {
    type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
};
