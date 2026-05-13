import {
  createEmptyExecutionTrace,
  type ExecutionDiagnostic,
  type ExecutionLimits,
  type ExecutionMetrics,
  type ExecutionPhaseName,
  type ExecutionPhaseResult,
  type ExecutionStatus,
  type ExecutionStdinSummary,
  type ExecutionTrace,
  type SupportedLanguage,
} from "../types/execution";

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

const buildTimeoutSuggestion = (
  language: SupportedLanguage,
  stdinSummary: ExecutionStdinSummary,
) => {
  if (!stdinSummary.provided) {
    return "If this program expects standard input, add it in the Program Input panel before running again.";
  }

  if (language === "java" || language === "c" || language === "cpp") {
    return "Check for very large loops, unbounded recursion, or blocked input reads.";
  }

  return "Check for infinite loops, blocked input reads, or very large data processing.";
};

const classifyTrace = (
  trace: ExecutionTrace,
  language: SupportedLanguage,
): {
  status: ExecutionStatus;
  error: string;
  diagnostics: ExecutionDiagnostic[];
} => {
  const diagnostics: ExecutionDiagnostic[] = [];
  const compilePhase = trace.phases.compile;
  const runPhase = trace.phases.run;

  if (compilePhase?.status === "timed_out") {
    const detail =
      compilePhase.stderr.trim() ||
      `Compilation exceeded ${trace.limits.compileTimeoutMs}ms.`;
    diagnostics.push({
      category: "timeout",
      summary: "Compilation timed out.",
      detail,
      suggestion:
        "Reduce template/macros complexity or try again with a smaller compile unit.",
    });
    return {
      status: "timed_out",
      error: `Compilation timed out after ${trace.limits.compileTimeoutMs}ms.`,
      diagnostics,
    };
  }

  if (compilePhase && compilePhase.status === "failed") {
    const detail = compilePhase.stderr.trim() || compilePhase.stdout.trim();
    diagnostics.push({
      category: "compile",
      summary: "Compilation failed.",
      detail: detail || "The compiler reported an error.",
      suggestion:
        language === "java"
          ? "Make sure the public entry class is named Main and all syntax errors are fixed."
          : "Fix the reported syntax or type errors and run again.",
    });
    return {
      status: "compile_error",
      error: detail || "Compilation failed.",
      diagnostics,
    };
  }

  if (runPhase?.timedOut || runPhase?.status === "timed_out") {
    const detail =
      runPhase.stderr.trim() ||
      `Program execution exceeded ${trace.limits.runTimeoutMs}ms.`;
    diagnostics.push({
      category: "timeout",
      summary: "Program execution timed out.",
      detail,
      suggestion: buildTimeoutSuggestion(language, trace.stdin),
    });
    return {
      status: "timed_out",
      error: `Execution timed out after ${trace.limits.runTimeoutMs}ms.`,
      diagnostics,
    };
  }

  if (runPhase && runPhase.status === "failed") {
    const detail = runPhase.stderr.trim() || runPhase.stdout.trim();
    diagnostics.push({
      category: "runtime",
      summary: "Program failed during execution.",
      detail: detail || "The program exited with a non-zero status.",
      suggestion:
        "Inspect the runtime output and error stream for exceptions, invalid input handling, or segmentation faults.",
    });
    return {
      status: "runtime_error",
      error: detail || "Program execution failed.",
      diagnostics,
    };
  }

  return {
    status: "completed",
    error: "",
    diagnostics,
  };
};

export const finalizeTrace = (
  trace: ExecutionTrace,
  language: SupportedLanguage,
  runtimeMetrics?: Partial<ExecutionMetrics>,
) => {
  trace.metrics = {
    ...trace.metrics,
    ...runtimeMetrics,
    executionTimeMs:
      (runtimeMetrics?.compileTimeMs ?? trace.metrics.compileTimeMs) +
      (runtimeMetrics?.runTimeMs ?? trace.metrics.runTimeMs),
  };
  trace.executionTime = trace.metrics.executionTimeMs;
  const classification = classifyTrace(trace, language);
  trace.status = classification.status;
  trace.error = classification.error;
  trace.timedOut = classification.status === "timed_out";
  trace.diagnostics = classification.diagnostics;
  return trace;
};
