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

export interface HeapSnapshotNode {
  id: string;
  label: string;
  type: string;
  value: string;
  scope?: string;
}

export interface FunctionCallSnapshot {
  name: string;
  event: "enter" | "exit" | "active";
  depth: number;
  lineNumber: number;
}

export interface ScopeSnapshot {
  name: string;
  variables: VariableSnapshot[];
}

export interface MemoryChange {
  target: string;
  scope: string;
  kind: "added" | "updated" | "removed" | "stdout";
  before?: string;
  after?: string;
}

export type TraceFrameQuality = "full" | "fallback" | "empty";

export interface TraceSummary {
  available: boolean;
  frameCount: number;
  quality: TraceFrameQuality;
  source: string;
  status: "ready" | "fallback" | "failed" | "empty";
  message: string;
  error: string;
}

export type ExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "compile_error"
  | "runtime_missing"
  | "runtime_error"
  | "timed_out"
  | "memory_limit"
  | "trace_failure"
  | "internal_error";

export type ExecutionFailureCategory =
  | "compile"
  | "runtime_missing"
  | "runtime"
  | "timeout"
  | "memory"
  | "trace"
  | "internal";

export type ExecutionPhaseName = "compile" | "run" | "trace";

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
  signal: string | null;
  durationMs: number;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  failureCategory: ExecutionFailureCategory | null;
  summary: string;
  oomKilled?: boolean;
}

export interface ExecutionLimits {
  queueConcurrency: number;
  queueDepthLimit: number;
  compileTimeoutMs: number;
  runTimeoutMs: number;
  traceTimeoutMs: number;
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

export type ExecutionMode = "trace" | "safe" | "performance";

export type TraceStrategy = "full" | "best_effort" | "skipped";

export interface ExecutionModeSelection {
  selected: ExecutionMode;
  autoSelected: boolean;
  reason: string;
  traceStrategy: TraceStrategy;
}

export interface ExecutionStdinSummary {
  provided: boolean;
  lineCount: number;
  charCount: number;
  preview: string;
}

export interface ExecutionDiagnostic {
  category: ExecutionFailureCategory;
  phase: ExecutionPhaseName | "system";
  severity: "error" | "warning" | "info";
  source: string;
  summary: string;
  detail: string;
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  raw?: string;
  stackTrace?: string[];
  suggestion?: string;
}

export type ExecutionLogLevel = "error" | "warn" | "info" | "debug";

export interface ExecutionLogEntry {
  timestamp: string;
  level: ExecutionLogLevel;
  scope: string;
  message: string;
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
  stack?: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface ExecutionStep {
  line: number;
  description: string;
  explanation?: string;
  variables: VariableSnapshot[] | Record<string, unknown>;
  stack?: StackFrameSnapshot[];
  output: string[];
  lineNumber?: number;
  codeLine?: string;
  heap?: HeapSnapshotNode[];
  stdout?: string[];
  timestamp?: number;
  functionCalls?: FunctionCallSnapshot[];
  activeScopes?: ScopeSnapshot[];
  memoryChanges?: MemoryChange[];
  traceSource?: string;
  traceQuality?: TraceFrameQuality;
}

export interface ExecutionTimeline {
  steps: ExecutionStep[];
  output: string[];
  error?: string;
  truncated?: boolean;
}

export interface ExecutionTrace {
  executionId: string;
  traceId: string;
  startedAt: string;
  completedAt: string | null;
  steps: ExecutionStep[];
  traceFrames: ExecutionStep[];
  traceSummary: TraceSummary;
  output: string;
  outputLines: string[];
  error: string;
  executionTime: number;
  timedOut: boolean;
  language: SupportedLanguage;
  status: ExecutionStatus;
  failurePhase: ExecutionPhaseName | "system" | null;
  phases: {
    compile: ExecutionPhaseResult | null;
    run: ExecutionPhaseResult | null;
    trace: ExecutionPhaseResult | null;
  };
  mode: ExecutionModeSelection;
  limits: ExecutionLimits;
  metrics: ExecutionMetrics;
  diagnostics: ExecutionDiagnostic[];
  logs: {
    system: string[];
    entries: ExecutionLogEntry[];
  };
  stdin: ExecutionStdinSummary;
}
