import {
  createEmptyExecutionTrace,
  type ExecutionLimits,
  type ExecutionMetrics,
  type ExecutionPhaseName,
  type ExecutionPhaseResult,
  type ExecutionStdinSummary,
  type ExecutionTrace,
  type SupportedLanguage,
} from "../types/execution";
import { createStructuredLogger } from "../logging/logger";
import {
  classifyExecutionOutcome,
  collectExecutionDiagnostics,
} from "./executionDiagnostics";

export const summarizeStdin = (stdin: string): ExecutionStdinSummary => {
  const normalized = stdin.replace(/\r\n/g, "\n");
  const preview = normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;

  return {
    provided: normalized.length > 0,
    lineCount: normalized.length === 0 ? 0 : normalized.split("\n").length,
    charCount: normalized.length,
    preview,
  };
};

export const createTraceSkeleton = (
  language: SupportedLanguage,
  limits: ExecutionLimits,
  stdin: ExecutionStdinSummary,
  queueTimeMs: number,
): ExecutionTrace => ({
  ...createEmptyExecutionTrace(language),
  limits,
  stdin,
  status: "running",
  metrics: {
    queueTimeMs,
    executionTimeMs: 0,
    compileTimeMs: 0,
    runTimeMs: 0,
    peakMemoryBytes: null,
    peakMemoryKb: null,
  },
});

export const setPhase = (
  trace: ExecutionTrace,
  phase: ExecutionPhaseName,
  result: ExecutionPhaseResult,
) => {
  trace.phases[phase] = result;
  if (phase === "compile") {
    trace.metrics.compileTimeMs = result.durationMs;
  }
  if (phase === "run") {
    trace.metrics.runTimeMs = result.durationMs;
  }
};

export const finalizeTrace = (
  trace: ExecutionTrace,
  language: SupportedLanguage,
  runtimeMetrics?: Partial<ExecutionMetrics>,
) => {
  const logger = createStructuredLogger({
    scope: "TRACE_RESULT",
    trace,
    defaultContext: {
      executionId: trace.executionId,
      traceId: trace.traceId,
      language,
    },
  });
  trace.metrics = {
    ...trace.metrics,
    ...runtimeMetrics,
    executionTimeMs:
      (runtimeMetrics?.compileTimeMs ?? trace.metrics.compileTimeMs) +
      (runtimeMetrics?.runTimeMs ?? trace.metrics.runTimeMs),
  };
  trace.executionTime = trace.metrics.executionTimeMs;
  const diagnostics = collectExecutionDiagnostics(language, [
    trace.phases.compile,
    trace.phases.run,
    trace.phases.trace,
  ]);
  const classification = classifyExecutionOutcome({
    language,
    compilePhase: trace.phases.compile,
    runPhase: trace.phases.run,
    tracePhase: trace.phases.trace,
    systemLogs: trace.logs.system,
    diagnostics,
    stdinProvided: trace.stdin.provided,
  });
  trace.status = classification.status;
  trace.error = classification.error;
  trace.failurePhase = classification.failurePhase;
  trace.timedOut = classification.status === "timed_out";
  trace.diagnostics = classification.diagnostics;
  trace.completedAt = new Date().toISOString();
  logger.runtime("Execution trace finalized.", {
    phase: classification.failurePhase ?? "system",
    durationMs: trace.executionTime,
    details: {
      status: trace.status,
      diagnosticCount: trace.diagnostics.length,
      stepCount: trace.traceFrames.length,
      outputLineCount: trace.outputLines.length,
      traceQuality: trace.traceSummary.quality,
      traceStatus: trace.traceSummary.status,
    },
  });
  return trace;
};
