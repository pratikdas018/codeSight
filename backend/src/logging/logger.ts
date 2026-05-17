import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type {
  ExecutionLogEntry,
  ExecutionLogLevel,
  ExecutionPhaseName,
  ExecutionTrace,
  SupportedLanguage,
} from "../types/execution";

interface LoggerContext {
  executionId?: string;
  traceId?: string;
  phase?: ExecutionPhaseName | "system";
  language?: SupportedLanguage;
  command?: string;
  filePath?: string;
  durationMs?: number | null;
  exitCode?: number | null;
  signal?: string | null;
  stdout?: string;
  stderr?: string;
  details?: Record<string, unknown>;
}

interface LoggerOptions {
  scope: string;
  trace?: ExecutionTrace;
  defaultContext?: Omit<LoggerContext, "details"> & {
    details?: Record<string, unknown>;
  };
}

const defaultLogFilePath = process.env.CODESIGHT_LOG_FILE?.trim() || "";
const logLevelPriority: Record<ExecutionLogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const verboseLoggingEnabled =
  process.env.CODESIGHT_VERBOSE_LOGS?.trim().toLowerCase() === "true";

const parseLogLevel = (value: string | undefined): ExecutionLogLevel | null => {
  switch (value?.trim().toLowerCase()) {
    case "error":
    case "warn":
    case "info":
    case "debug":
      return value.trim().toLowerCase() as ExecutionLogLevel;
    default:
      return null;
  }
};

const configuredConsoleLogLevel =
  parseLogLevel(process.env.CODESIGHT_LOG_LEVEL) ??
  parseLogLevel(process.env.LOG_LEVEL) ??
  (verboseLoggingEnabled
    ? "debug"
    : process.env.NODE_ENV === "production"
      ? "error"
      : "warn");

const normalizeDetailValue = (
  value: unknown,
): string | number | boolean | null => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "undefined") {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? `${error.name}: ${error.message}`,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
      stack: error,
    };
  }

  try {
    const serialized = JSON.stringify(error);
    return {
      message: serialized,
      stack: serialized,
    };
  } catch {
    const fallback = String(error);
    return {
      message: fallback,
      stack: fallback,
    };
  }
};

const writeOptionalFileLog = (entry: ExecutionLogEntry) => {
  if (!defaultLogFilePath) {
    return;
  }

  try {
    mkdirSync(path.dirname(defaultLogFilePath), { recursive: true });
    appendFileSync(defaultLogFilePath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    return;
  }
};

const emitConsoleLog = (entry: ExecutionLogEntry) => {
  if (logLevelPriority[entry.level] > logLevelPriority[configuredConsoleLogLevel]) {
    return;
  }

  const label = `[${entry.scope}] ${entry.message}`;
  const payload = {
    timestamp: entry.timestamp,
    level: entry.level,
    executionId: entry.executionId ?? null,
    traceId: entry.traceId ?? null,
    phase: entry.phase ?? null,
    language: entry.language ?? null,
    command: entry.command ?? null,
    filePath: entry.filePath ?? null,
    durationMs: entry.durationMs ?? null,
    exitCode: entry.exitCode ?? null,
    signal: entry.signal ?? null,
    details: entry.details ?? null,
    stdout: entry.stdout || undefined,
    stderr: entry.stderr || undefined,
    stack: entry.stack || undefined,
  };

  if (entry.level === "error") {
    console.error(label, payload);
    return;
  }

  if (entry.level === "warn") {
    console.warn(label, payload);
    return;
  }

  if (entry.level === "debug") {
    console.debug(label, payload);
    return;
  }

  console.info(label, payload);
};

const pushTraceLog = (trace: ExecutionTrace | undefined, entry: ExecutionLogEntry) => {
  if (!trace) {
    return;
  }

  trace.logs.entries.push(entry);

  if (entry.level === "error") {
    trace.logs.system.push(
      `[${entry.scope}] ${entry.message}${entry.phase ? ` (${entry.phase})` : ""}`,
    );
  }
};

const buildEntry = (
  level: ExecutionLogLevel,
  scope: string,
  message: string,
  context: LoggerContext = {},
  error?: unknown,
): ExecutionLogEntry => {
  const serializedError = typeof error === "undefined" ? null : serializeError(error);

  return {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message:
      serializedError && !message.includes(serializedError.message)
        ? `${message}: ${serializedError.message}`
        : message,
    ...(context.executionId ? { executionId: context.executionId } : {}),
    ...(context.traceId ? { traceId: context.traceId } : {}),
    ...(context.phase ? { phase: context.phase } : {}),
    ...(context.language ? { language: context.language } : {}),
    ...(context.command ? { command: context.command } : {}),
    ...(context.filePath ? { filePath: context.filePath } : {}),
    ...(typeof context.durationMs !== "undefined"
      ? { durationMs: context.durationMs }
      : {}),
    ...(typeof context.exitCode !== "undefined"
      ? { exitCode: context.exitCode }
      : {}),
    ...(typeof context.signal !== "undefined" ? { signal: context.signal } : {}),
    ...(context.stdout ? { stdout: context.stdout } : {}),
    ...(context.stderr ? { stderr: context.stderr } : {}),
    ...(serializedError?.stack ? { stack: serializedError.stack } : {}),
    ...(context.details
      ? {
          details: Object.fromEntries(
            Object.entries(context.details).map(([key, value]) => [
              key,
              normalizeDetailValue(value),
            ]),
          ),
        }
      : {}),
  };
};

export interface StructuredLogger {
  info: (message: string, context?: LoggerContext) => ExecutionLogEntry;
  warn: (message: string, context?: LoggerContext, error?: unknown) => ExecutionLogEntry;
  error: (message: string, error?: unknown, context?: LoggerContext) => ExecutionLogEntry;
  debug: (message: string, context?: LoggerContext) => ExecutionLogEntry;
  runtime: (message: string, context?: LoggerContext) => ExecutionLogEntry;
  trace: (message: string, context?: LoggerContext, error?: unknown) => ExecutionLogEntry;
}

export const createStructuredLogger = ({
  scope,
  trace,
  defaultContext,
}: LoggerOptions): StructuredLogger => {
  const writeEntry = (
    level: ExecutionLogLevel,
    message: string,
    context: LoggerContext = {},
    error?: unknown,
  ) => {
    const entry = buildEntry(level, scope, message, {
      ...defaultContext,
      ...context,
      details: {
        ...(defaultContext?.details ?? {}),
        ...(context.details ?? {}),
      },
    }, error);
    emitConsoleLog(entry);
    writeOptionalFileLog(entry);
    pushTraceLog(trace, entry);
    return entry;
  };

  return {
    info: (message, context) => writeEntry("info", message, context),
    warn: (message, context, error) => writeEntry("warn", message, context, error),
    error: (message, error, context) => writeEntry("error", message, context, error),
    debug: (message, context) => writeEntry("debug", message, context),
    runtime: (message, context) => writeEntry("info", message, context),
    trace: (message, context, error) => writeEntry("debug", message, context, error),
  };
};
