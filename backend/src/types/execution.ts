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
  variables: VariableSnapshot[];
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
  language,
  steps: [],
  output: "",
  outputLines: [],
  error: "",
  executionTime: 0,
  timedOut: false,
  status: "completed",
  phases: {
    compile: null,
    run: null,
  },
  limits: {
    queueConcurrency: 1,
    queueDepthLimit: 0,
    compileTimeoutMs: 0,
    runTimeoutMs: 0,
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
  stdin: {
    provided: false,
    lineCount: 0,
    charCount: 0,
    preview: "",
  },
});
