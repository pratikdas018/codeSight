import type { RealtimeChannel } from "@supabase/supabase-js";
import { requireSupabase } from "../lib/supabase";
import type { Json } from "../lib/supabase.types";
import type { ExecutionTrace } from "../engine/types";
import type { FeedbackCategory, FeedbackDraft } from "./feedbackService";
import { requireSessionUserId } from "./sessionService";
import type { SupportedLanguage } from "../utils/types";

const toJsonObject = (value: Record<string, unknown>): Json =>
  JSON.parse(JSON.stringify(value)) as Json;

export type AnalyticsAction =
  | "app_open"
  | "login"
  | "logout"
  | "code_execution"
  | "failed_execution"
  | "runtime_error"
  | "visualization_playback"
  | "export_usage"
  | "save_file"
  | "open_file"
  | "language_switch";

export const trackUserActivity = async (payload: {
  action: AnalyticsAction;
  language?: SupportedLanguage | null;
  metadata?: Json;
  userId: string;
}) => {
  const sessionUserId = await requireSessionUserId(payload.userId);
  const { error } = await requireSupabase().from("user_activity").insert({
    user_id: sessionUserId,
    action: payload.action,
    language: payload.language ?? null,
    metadata: payload.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const trackUserActivitySafe = async (payload: Parameters<typeof trackUserActivity>[0]) => {
  try {
    await trackUserActivity(payload);
  } catch {
    return;
  }
};

export const trackExecutionLog = async (payload: {
  userId: string;
  language: SupportedLanguage;
  code: string;
  trace: ExecutionTrace;
  metadata?: Json;
}) => {
  const sessionUserId = await requireSessionUserId(payload.userId);
  const { error } = await requireSupabase().from("execution_logs").insert({
    user_id: sessionUserId,
    language: payload.language,
    code_length: payload.code.length,
    execution_time: payload.trace.executionTime ?? payload.trace.metrics.executionTimeMs ?? 0,
    compile_time: payload.trace.metrics.compileTimeMs ?? payload.trace.phases.compile?.durationMs ?? 0,
    trace_time: payload.trace.phases.trace?.durationMs ?? 0,
    success: payload.trace.status === "completed",
    error_message: payload.trace.error || null,
    error_type: payload.trace.failurePhase ?? null,
    runtime_status: payload.trace.status,
    code_preview: payload.code.slice(0, 600),
    metadata: payload.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const trackExecutionLogSafe = async (payload: Parameters<typeof trackExecutionLog>[0]) => {
  try {
    await trackExecutionLog(payload);
  } catch {
    return;
  }
};

export const trackVisualizationSession = async (payload: {
  userId: string;
  language: SupportedLanguage;
  totalSteps: number;
  playbackDuration: number;
  metadata?: Json;
}) => {
  const sessionUserId = await requireSessionUserId(payload.userId);
  const { error } = await requireSupabase().from("visualization_sessions").insert({
    user_id: sessionUserId,
    language: payload.language,
    total_steps: payload.totalSteps,
    playback_duration: payload.playbackDuration,
    metadata: payload.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const trackVisualizationSessionSafe = async (
  payload: Parameters<typeof trackVisualizationSession>[0],
) => {
  try {
    await trackVisualizationSession(payload);
  } catch {
    return;
  }
};

export const submitFeedbackReport = async (
  payload: FeedbackDraft & {
    userId?: string | null;
  },
) => {
  const userId = payload.userId ? await requireSessionUserId(payload.userId) : null;
  const { error } = await requireSupabase().from("feedback_reports").insert({
    user_id: userId,
    message: payload.message,
    type: payload.category satisfies FeedbackCategory,
    metadata: toJsonObject({
      email: payload.email,
      context: payload.context,
    }),
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const captureCrashReportSafe = async (payload: {
  userId?: string | null;
  language?: SupportedLanguage | null;
  errorMessage: string;
  stackTrace?: string | null;
  severity?: "info" | "warning" | "error" | "critical";
  metadata?: Json;
}) => {
  try {
    const userId = payload.userId ? await requireSessionUserId(payload.userId) : null;
    await requireSupabase().from("crash_reports").insert({
      user_id: userId,
      language: payload.language ?? null,
      error_message: payload.errorMessage,
      stack_trace: payload.stackTrace ?? null,
      severity: payload.severity ?? "error",
      metadata: payload.metadata ?? {},
    });
  } catch {
    return;
  }
};

export const subscribeToAdminRealtime = (
  onChange: () => void,
): RealtimeChannel => {
  const channel = requireSupabase()
    .channel(`admin-dashboard-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_activity" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "execution_logs" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "visualization_sessions" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "feedback_reports" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "crash_reports" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      onChange,
    )
    .subscribe();

  return channel;
};

export const unsubscribeRealtimeChannel = async (channel: RealtimeChannel) => {
  await requireSupabase().removeChannel(channel);
};
