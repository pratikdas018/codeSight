import { randomUUID } from "node:crypto";

export const supportedLanguages = [
  "javascript",
  "python",
  "c",
  "cpp",
  "java",
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

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

export interface ChangedVariable {
  name: string;
  scope: string;
  before?: string;
  after?: string;
}

export type TraceEventType =
  | "ASSIGNMENT"
  | "VARIABLE_DECLARATION"
  | "VARIABLE_UPDATE"
  | "LOOP_ENTER"
  | "LOOP_ITERATION"
  | "LOOP_INCREMENT"
  | "CONDITION_TRUE"
  | "CONDITION_FALSE"
  | "FUNCTION_CALL"
  | "FUNCTION_RETURN"
  | "ARRAY_READ"
  | "ARRAY_WRITE"
  | "VECTOR_READ"
  | "VECTOR_WRITE"
  | "STACK_PUSH"
  | "STACK_POP"
  | "QUEUE_PUSH"
  | "QUEUE_POP"
  | "RECURSION_ENTER"
  | "RECURSION_RETURN"
  | "MEMORY_ALLOCATE"
  | "MEMORY_FREE"
  | "POINTER_UPDATE"
  | "STL_CONTAINER_MUTATION"
  | "GRAPH_TRAVERSAL"
  | "TREE_TRAVERSAL"
  | "OUTPUT"
  | "STEP";

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
  frameId?: string;
  eventType?: TraceEventType;
  line: number;
  lineNumber?: number;
  codeLine?: string;
  description: string;
  explanation?: string;
  variables: VariableSnapshot[];
  variablesBefore?: VariableSnapshot[];
  variablesAfter?: VariableSnapshot[];
  changedVariables?: ChangedVariable[];
  stack?: StackFrameSnapshot[];
  stackFrames?: StackFrameSnapshot[];
  output: string[];
  heap?: HeapSnapshotNode[];
  heapState?: HeapSnapshotNode[];
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

export interface ExecutionRequest {
  code: string;
  language: SupportedLanguage;
  stdin?: string;
}

export const isSupportedLanguage = (
  value: string,
): value is SupportedLanguage =>
  supportedLanguages.includes(value as SupportedLanguage);

export const splitOutputLines = (output: string) => {
  if (!output) {
    return [];
  }

  const normalized = output.replace(/\r\n/g, "\n");

  if (normalized.endsWith("\n")) {
    return normalized.slice(0, -1).split("\n");
  }

  return normalized.split("\n");
};

export const createEmptyExecutionTrace = (
  language: SupportedLanguage,
): ExecutionTrace => ({
  executionId: randomUUID(),
  traceId: randomUUID(),
  startedAt: new Date().toISOString(),
  completedAt: null,
  language,
  steps: [],
  traceFrames: [],
  traceSummary: {
    available: false,
    frameCount: 0,
    quality: "empty",
    source: "uninitialized",
    status: "empty",
    message: "Run your program to generate a visualization timeline.",
    error: "",
  },
  output: "",
  outputLines: [],
  error: "",
  executionTime: 0,
  timedOut: false,
  status: "completed",
  failurePhase: null,
  phases: {
    compile: null,
    run: null,
    trace: null,
  },
  mode: {
    selected: "trace",
    autoSelected: true,
    reason: "CodeSight has not analyzed this program yet.",
    traceStrategy: "full",
  },
  limits: {
    queueConcurrency: 1,
    queueDepthLimit: 0,
    compileTimeoutMs: 0,
    runTimeoutMs: 0,
    traceTimeoutMs: 0,
    memoryLimitMb: 0,
    cpuLimit: 0,
    pidsLimit: 0,
  },
  metrics: {
    queueTimeMs: 0,
    executionTimeMs: 0,
    compileTimeMs: 0,
    runTimeMs: 0,
    peakMemoryBytes: null,
    peakMemoryKb: null,
  },
  diagnostics: [],
  logs: {
    system: [],
    entries: [],
  },
  stdin: {
    provided: false,
    lineCount: 0,
    charCount: 0,
    preview: "",
  },
});
