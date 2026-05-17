import type {
  ExecutionFailureCategory,
  ExecutionPhaseName,
  ExecutionPhaseResult,
} from "../types/execution";
import type { RunCommandWithLimitsResult } from "./runCommandWithLimits";

const fallbackFailureCategory = (
  phase: ExecutionPhaseName,
): ExecutionFailureCategory =>
  phase === "compile" ? "compile" : phase === "trace" ? "trace" : "runtime";

const defaultSummary = (
  phase: ExecutionPhaseName,
  failureCategory: ExecutionFailureCategory | null,
) => {
  if (!failureCategory) {
    return `${phase[0].toUpperCase()}${phase.slice(1)} phase completed successfully.`;
  }

  switch (failureCategory) {
    case "timeout":
      return phase === "compile"
        ? "Compilation timed out."
        : phase === "trace"
          ? "Trace generation timed out."
          : "Program execution timed out.";
    case "memory":
      return phase === "compile"
        ? "Compilation exceeded the memory limit."
        : "Program exceeded the memory limit.";
    case "runtime_missing":
      return "Required local runtime is missing.";
    case "trace":
      return "Trace generation failed.";
    case "compile":
      return "Compilation failed.";
    case "runtime":
      return "Program execution failed.";
    default:
      return "Execution failed.";
  }
};

export const createPhaseResult = (
  phase: ExecutionPhaseName,
  command: string,
  result: RunCommandWithLimitsResult,
  overrides?: Partial<
    Pick<ExecutionPhaseResult, "failureCategory" | "summary" | "oomKilled">
  >,
): ExecutionPhaseResult => {
  let failureCategory: ExecutionFailureCategory | null = null;

  if (result.timedOut) {
    failureCategory = "timeout";
  } else if (overrides?.oomKilled) {
    failureCategory = "memory";
  } else if (result.exitCode !== 0 || result.signal !== null || result.outputLimitExceeded) {
    failureCategory = overrides?.failureCategory ?? fallbackFailureCategory(phase);
  }

  const status =
    result.timedOut
      ? "timed_out"
      : failureCategory
        ? "failed"
        : "completed";

  return {
    phase,
    status,
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    signal: result.signal,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    outputLimitExceeded: result.outputLimitExceeded,
    failureCategory,
    summary: overrides?.summary ?? defaultSummary(phase, failureCategory),
    ...(overrides?.oomKilled ? { oomKilled: true } : {}),
  };
};

export const createSkippedPhaseResult = (
  phase: ExecutionPhaseName,
  command: string,
  summary: string,
): ExecutionPhaseResult => ({
  phase,
  status: "skipped",
  command,
  stdout: "",
  stderr: "",
  exitCode: null,
  signal: null,
  durationMs: 0,
  timedOut: false,
  outputLimitExceeded: false,
  failureCategory: null,
  summary,
});

export const createSyntheticPhaseFailure = (
  phase: ExecutionPhaseName,
  command: string,
  message: string,
  failureCategory: ExecutionFailureCategory,
  durationMs = 0,
): ExecutionPhaseResult => ({
  phase,
  status: "failed",
  command,
  stdout: "",
  stderr: message,
  exitCode: null,
  signal: null,
  durationMs,
  timedOut: failureCategory === "timeout",
  outputLimitExceeded: false,
  failureCategory,
  summary: defaultSummary(phase, failureCategory),
});
