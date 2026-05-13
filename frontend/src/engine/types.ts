import type { SupportedLanguage } from "../utils/types";

export interface VariableSnapshot {
  name: string;
  scope: string;
  value: string;
}

export interface StackFrameSnapshot {
  name: string;
  locals: VariableSnapshot[];
}

export type ExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "compile_error"
  | "runtime_error"
  | "timed_out"
  | "internal_error";

export type ExecutionPhaseName = "compile" | "run";

export type ExecutionPhaseStatus =
  | "pending"
  | "completed"
  | "failed"
  | "timed_out"
  | "skipped";

export interface ExecutionPhaseResult {
  phase: ExecutionPhaseName;
  status: ExecutionPhaseStatus;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

export interface ExecutionLimits {
  queueConcurrency: number;
  queueDepthLimit: number;
  compileTimeoutMs: number;
  runTimeoutMs: number;
  memoryLimitMb: number;
  cpuLimit: number;
  pidsLimit: number;
}

export interface ExecutionMetrics {
  queueTimeMs: number;
  executionTimeMs: number;
  compileTimeMs: number;
  runTimeMs: number;
  peakMemoryBytes: number | null;
  peakMemoryKb: number | null;
}

export interface ExecutionStdinSummary {
  provided: boolean;
  lineCount: number;
  charCount: number;
  preview: string;
}

export interface ExecutionDiagnostic {
  category: "compile" | "runtime" | "timeout" | "internal";
  summary: string;
  detail: string;
  suggestion?: string;
}

export interface ExecutionStep {
  line: number;
  description: string;
  explanation?: string;
  variables: VariableSnapshot[] | Record<string, unknown>;
  stack?: StackFrameSnapshot[];
  output: string[];
}

export interface ExecutionTimeline {
  steps: ExecutionStep[];
  output: string[];
  error?: string;
}

export interface ExecutionTrace {
  steps: ExecutionStep[];
  output: string;
  outputLines: string[];
  error: string;
  executionTime: number;
  timedOut: boolean;
  language: SupportedLanguage;
  status: ExecutionStatus;
  phases: {
    compile: ExecutionPhaseResult | null;
    run: ExecutionPhaseResult | null;
  };
  limits: ExecutionLimits;
  metrics: ExecutionMetrics;
  diagnostics: ExecutionDiagnostic[];
  stdin: ExecutionStdinSummary;
}
