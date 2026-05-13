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
}
