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

export interface ExecutionStep {
  line: number;
  description: string;
  explanation?: string;
  variables: VariableSnapshot[];
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
});
