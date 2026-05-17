import type {
  ExecutionDiagnostic,
  ExecutionLogEntry,
  ExecutionPhaseResult,
  ExecutionTrace,
} from "../engine/types";

type RendererLogLevel = ExecutionLogEntry["level"];

interface RendererLogConfig {
  level: RendererLogLevel;
  verbose: boolean;
}

type RendererLoggerContext = Record<string, unknown> & {
  executionId?: string;
  traceId?: string;
  phase?: ExecutionLogEntry["phase"];
  language?: ExecutionLogEntry["language"];
  command?: string;
  filePath?: string;
  durationMs?: number | null;
  exitCode?: number | null;
  signal?: string | null;
  stdout?: string;
  stderr?: string;
};

const logLevelPriority: Record<RendererLogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const structuredContextKeys = new Set<keyof RendererLoggerContext>([
  "executionId",
  "traceId",
  "phase",
  "language",
  "command",
  "filePath",
  "durationMs",
  "exitCode",
  "signal",
  "stdout",
  "stderr",
]);

const parseLogLevel = (value: string | undefined): RendererLogLevel | null => {
  switch (value?.trim().toLowerCase()) {
    case "error":
    case "warn":
    case "info":
    case "debug":
      return value.trim().toLowerCase() as RendererLogLevel;
    default:
      return null;
  }
};

const resolveRendererLogConfig = (): RendererLogConfig => {
  const electronLogging = window.electronAPI?.env.logging;
  const verbose =
    electronLogging?.verbose ??
    import.meta.env.VITE_CODESIGHT_VERBOSE_LOGS?.trim().toLowerCase() === "true";
  const explicitLevel =
    electronLogging?.level ?? parseLogLevel(import.meta.env.VITE_CODESIGHT_LOG_LEVEL);

  return {
    level:
      explicitLevel ??
      (verbose ? "debug" : import.meta.env.DEV ? "warn" : "error"),
    verbose,
  };
};

const shouldEmitLog = (level: RendererLogLevel) => {
  const config = resolveRendererLogConfig();
  return logLevelPriority[level] <= logLevelPriority[config.level];
};

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

const getBadgeStyle = (level: RendererLogLevel) => {
  switch (level) {
    case "error":
      return "color:#fff;background:#b42318;padding:2px 7px;border-radius:999px;font-weight:700;";
    case "warn":
      return "color:#111827;background:#f4c430;padding:2px 7px;border-radius:999px;font-weight:700;";
    case "debug":
      return "color:#e5e7eb;background:#374151;padding:2px 7px;border-radius:999px;font-weight:700;";
    default:
      return "color:#04130a;background:#72ff70;padding:2px 7px;border-radius:999px;font-weight:700;";
  }
};

const shortId = (value?: string) => (value ? value.slice(0, 8) : "n/a");

const formatTimestamp = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const buildConsolePayload = (entry: ExecutionLogEntry) => ({
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
});

const emitStructuredConsoleLog = (entry: ExecutionLogEntry) => {
  if (!shouldEmitLog(entry.level)) {
    return;
  }

  const heading = [
    `%c${entry.level.toUpperCase()}%c ${entry.scope} ${formatTimestamp(
      entry.timestamp,
    )} #${shortId(entry.executionId ?? entry.traceId)} ${entry.message}`,
    getBadgeStyle(entry.level),
    "color:inherit;",
  ] as const;
  const payload = buildConsolePayload(entry);

  if (entry.level === "error" || entry.level === "warn") {
    console.groupCollapsed(...heading);
    (entry.level === "error" ? console.error : console.warn)(payload);
    if (payload.stack) {
      console.error(payload.stack);
    }
    console.groupEnd();
    return;
  }

  if (entry.level === "debug") {
    console.debug(...heading, payload);
    return;
  }

  console.info(...heading, payload);
};

const getFailurePhase = (trace: ExecutionTrace) => {
  if (trace.failurePhase && trace.failurePhase !== "system") {
    return trace.phases[trace.failurePhase];
  }

  return (
    [trace.phases.compile, trace.phases.run, trace.phases.trace].find(
      (phase): phase is ExecutionPhaseResult => {
        if (!phase) {
          return false;
        }

        return phase.status !== "completed" && phase.status !== "skipped";
      },
    ) ?? null
  );
};

const getPrimaryDiagnostic = (
  trace: ExecutionTrace,
  failedPhase: ExecutionPhaseResult | null,
) =>
  trace.diagnostics.find(
    (diagnostic) =>
      diagnostic.phase === trace.failurePhase ||
      diagnostic.phase === failedPhase?.phase,
  ) ??
  trace.diagnostics[0] ??
  null;

const buildDiagnosticPayload = (diagnostic: ExecutionDiagnostic) => ({
  phase: diagnostic.phase,
  severity: diagnostic.severity,
  category: diagnostic.category,
  source: diagnostic.source,
  summary: diagnostic.summary,
  detail: diagnostic.detail,
  file: diagnostic.file ?? null,
  line: diagnostic.line ?? null,
  column: diagnostic.column ?? null,
  code: diagnostic.code ?? null,
  raw: diagnostic.raw ?? null,
  suggestion: diagnostic.suggestion ?? null,
  stackTrace: diagnostic.stackTrace?.join("\n") || undefined,
});

export const logStructuredEntry = (entry: ExecutionLogEntry) => {
  emitStructuredConsoleLog(entry);
};

export const logExecutionTrace = (
  trace: ExecutionTrace,
  context?: {
    trigger?: string;
  },
) => {
  const frameCount =
    trace.traceFrames.length > 0 ? trace.traceFrames.length : trace.steps.length;

  if (trace.status === "completed" && !shouldEmitLog("info")) {
    return;
  }

  const failedPhase = getFailurePhase(trace);
  const primaryDiagnostic = getPrimaryDiagnostic(trace, failedPhase);
  const errorEntries = trace.logs.entries.filter(
    (entry) => entry.level === "error" || entry.level === "warn",
  );
  const latestErrorEntry =
    errorEntries[errorEntries.length - 1] ??
    trace.logs.entries[trace.logs.entries.length - 1] ??
    null;

  if (trace.status === "completed") {
    console.groupCollapsed(
      `%cINFO%c EXECUTION ${trace.language.toUpperCase()} ${trace.status} ${formatTimestamp(
        trace.completedAt ?? trace.startedAt,
      )} #${shortId(trace.executionId)}`,
      getBadgeStyle("info"),
      "color:inherit;",
    );
    console.info({
      timestamp: trace.completedAt ?? trace.startedAt,
      executionId: trace.executionId,
      traceId: trace.traceId,
      language: trace.language,
      status: trace.status,
      durationMs: trace.executionTime,
      frames: frameCount,
      traceStatus: trace.traceSummary.status,
      traceQuality: trace.traceSummary.quality,
      trigger: context?.trigger ?? null,
    });
    console.groupEnd();
    return;
  }

  const payload = {
    timestamp: trace.completedAt ?? new Date().toISOString(),
    executionId: trace.executionId,
    traceId: trace.traceId,
    language: trace.language,
    phase: trace.failurePhase ?? failedPhase?.phase ?? "system",
    message:
      primaryDiagnostic?.summary ||
      trace.error ||
      failedPhase?.summary ||
      "Execution failed.",
    stderr:
      failedPhase?.stderr ||
      primaryDiagnostic?.detail ||
      trace.error ||
      undefined,
    stack:
      latestErrorEntry?.stack ||
      primaryDiagnostic?.stackTrace?.join("\n") ||
      undefined,
    file:
      primaryDiagnostic?.file ||
      latestErrorEntry?.filePath ||
      null,
    exitCode: failedPhase?.exitCode ?? latestErrorEntry?.exitCode ?? null,
    command: failedPhase?.command ?? latestErrorEntry?.command ?? null,
    status: trace.status,
    durationMs: trace.executionTime,
    trigger: context?.trigger ?? null,
  };

  console.groupCollapsed(
    `%cERROR%c EXECUTION ${trace.language.toUpperCase()} ${String(
      trace.failurePhase ?? failedPhase?.phase ?? "system",
    ).toUpperCase()} ${formatTimestamp(
      trace.completedAt ?? trace.startedAt,
    )} #${shortId(trace.executionId)}`,
    getBadgeStyle("error"),
    "color:inherit;",
  );
  console.error(payload);

  if (failedPhase) {
    console.groupCollapsed("Phase details");
    console.error({
      phase: failedPhase.phase,
      status: failedPhase.status,
      command: failedPhase.command,
      durationMs: failedPhase.durationMs,
      exitCode: failedPhase.exitCode,
      signal: failedPhase.signal,
      stderr: failedPhase.stderr || undefined,
      stdout: failedPhase.stdout || undefined,
      summary: failedPhase.summary,
      failureCategory: failedPhase.failureCategory,
      timedOut: failedPhase.timedOut,
      outputLimitExceeded: failedPhase.outputLimitExceeded,
      file:
        primaryDiagnostic?.file ??
        latestErrorEntry?.filePath ??
        null,
    });
    console.groupEnd();
  }

  if (trace.diagnostics.length > 0) {
    console.groupCollapsed("Diagnostics");
    trace.diagnostics.forEach((diagnostic) => {
      console.error(buildDiagnosticPayload(diagnostic));
    });
    console.groupEnd();
  }

  if (errorEntries.length > 0) {
    console.groupCollapsed("Structured logs");
    errorEntries.forEach(logStructuredEntry);
    console.groupEnd();
  }

  if (trace.logs.system.length > 0) {
    console.groupCollapsed("System logs");
    console.error(trace.logs.system.join("\n"));
    console.groupEnd();
  }

  console.groupEnd();
};

export const createRendererLogger = (scope: string) => {
  const splitContext = (context?: RendererLoggerContext) => {
    if (!context) {
      return {
        entryContext: {} as Omit<ExecutionLogEntry, "timestamp" | "level" | "scope" | "message">,
        details: undefined as ExecutionLogEntry["details"] | undefined,
      };
    }

    const entryContext: Omit<
      ExecutionLogEntry,
      "timestamp" | "level" | "scope" | "message"
    > = {};
    const details: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(context)) {
      if (structuredContextKeys.has(key as keyof RendererLoggerContext)) {
        switch (key) {
          case "executionId":
            entryContext.executionId = value as string;
            break;
          case "traceId":
            entryContext.traceId = value as string;
            break;
          case "phase":
            entryContext.phase = value as ExecutionLogEntry["phase"];
            break;
          case "language":
            entryContext.language = value as ExecutionLogEntry["language"];
            break;
          case "command":
            entryContext.command = value as string;
            break;
          case "filePath":
            entryContext.filePath = value as string;
            break;
          case "durationMs":
            entryContext.durationMs = value as number | null;
            break;
          case "exitCode":
            entryContext.exitCode = value as number | null;
            break;
          case "signal":
            entryContext.signal = value as string | null;
            break;
          case "stdout":
            entryContext.stdout = value as string;
            break;
          case "stderr":
            entryContext.stderr = value as string;
            break;
        }
        continue;
      }

      details[key] = normalizeDetailValue(value);
    }

    return {
      entryContext,
      details: Object.keys(details).length > 0 ? details : undefined,
    };
  };

  const write = (
    level: RendererLogLevel,
    message: string,
    context?: RendererLoggerContext,
    error?: unknown,
  ) => {
    const stack =
      error instanceof Error
        ? error.stack ?? `${error.name}: ${error.message}`
        : typeof error === "string"
          ? error
          : undefined;
    const { entryContext, details } = splitContext(context);

    const entry: ExecutionLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message:
        error instanceof Error ? `${message}: ${error.message}` : message,
      ...(stack ? { stack } : {}),
      ...entryContext,
      ...(details ? { details } : {}),
    };

    logStructuredEntry(entry);
    return entry;
  };

  return {
    info: (message: string, context?: RendererLoggerContext) =>
      write("info", message, context),
    warn: (
      message: string,
      context?: RendererLoggerContext,
      error?: unknown,
    ) => write("warn", message, context, error),
    error: (
      message: string,
      error?: unknown,
      context?: RendererLoggerContext,
    ) => write("error", message, context, error),
    debug: (message: string, context?: RendererLoggerContext) =>
      write("debug", message, context),
    runtime: (message: string, context?: RendererLoggerContext) =>
      write("info", message, context),
    trace: (
      message: string,
      context?: RendererLoggerContext,
      error?: unknown,
    ) => write("debug", message, context, error),
  };
};
