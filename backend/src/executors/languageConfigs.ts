import type { SupportedLanguage } from "../types/execution";

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export interface LanguageExecutionConfig {
  fileName: string;
  compileCommand?: string;
  runCommand: string;
  traceCommand?: string;
  compileTimeoutMs: number;
  runTimeoutMs: number;
  traceTimeoutMs: number;
  memoryLimitMb: number;
  cpuLimit: number;
  pidsLimit: number;
}

export interface ExecutionInfrastructureConfig {
  queueConcurrency: number;
  queueDepthLimit: number;
  outputBufferBytes: number;
}

const defaultMemoryLimitMb = parseNumber(
  process.env.EXECUTION_MEMORY_LIMIT_MB,
  512,
);
const defaultCpuLimit = parseNumber(process.env.EXECUTION_CPU_LIMIT, 1);
const defaultPidsLimit = parseNumber(process.env.EXECUTION_PIDS_LIMIT, 128);

export const executionInfrastructureConfig: ExecutionInfrastructureConfig = {
  queueConcurrency: Math.max(
    1,
    parseNumber(process.env.EXECUTION_QUEUE_CONCURRENCY, 2),
  ),
  queueDepthLimit: Math.max(
    1,
    parseNumber(process.env.EXECUTION_QUEUE_DEPTH_LIMIT, 50),
  ),
  outputBufferBytes: Math.max(
    256 * 1024,
    parseNumber(process.env.EXECUTION_MAX_OUTPUT_BYTES, 4 * 1024 * 1024),
  ),
};

export const languageExecutionConfigs: Record<
  SupportedLanguage,
  LanguageExecutionConfig
> = {
  javascript: {
    fileName: "main.js",
    runCommand: "node main.js",
    compileTimeoutMs: parseNumber(process.env.JAVASCRIPT_COMPILE_TIMEOUT_MS, 15_000),
    runTimeoutMs: parseNumber(process.env.JAVASCRIPT_RUN_TIMEOUT_MS, 20_000),
    traceTimeoutMs: parseNumber(process.env.JAVASCRIPT_TRACE_TIMEOUT_MS, 8_000),
    memoryLimitMb: defaultMemoryLimitMb,
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
  python: {
    fileName: "main.py",
    runCommand: "python main.py",
    traceCommand: "python trace",
    compileTimeoutMs: parseNumber(process.env.PYTHON_COMPILE_TIMEOUT_MS, 15_000),
    runTimeoutMs: parseNumber(process.env.PYTHON_RUN_TIMEOUT_MS, 20_000),
    traceTimeoutMs: parseNumber(process.env.PYTHON_TRACE_TIMEOUT_MS, 10_000),
    memoryLimitMb: defaultMemoryLimitMb,
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
  c: {
    fileName: "main.c",
    compileCommand: "gcc main.c -O2 -pipe -std=c11 -o program",
    runCommand: "program",
    compileTimeoutMs: parseNumber(process.env.C_COMPILE_TIMEOUT_MS, 15_000),
    runTimeoutMs: parseNumber(process.env.C_RUN_TIMEOUT_MS, 20_000),
    traceTimeoutMs: parseNumber(process.env.C_TRACE_TIMEOUT_MS, 6_000),
    memoryLimitMb: defaultMemoryLimitMb,
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
  cpp: {
    fileName: "main.cpp",
    compileCommand: "g++ main.cpp -O2 -pipe -std=c++17 -o program",
    runCommand: "program",
    compileTimeoutMs: parseNumber(process.env.CPP_COMPILE_TIMEOUT_MS, 15_000),
    runTimeoutMs: parseNumber(process.env.CPP_RUN_TIMEOUT_MS, 20_000),
    traceTimeoutMs: parseNumber(process.env.CPP_TRACE_TIMEOUT_MS, 6_000),
    memoryLimitMb: defaultMemoryLimitMb,
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
  java: {
    fileName: "Main.java",
    compileCommand: "javac Main.java",
    runCommand: "java -Xms64m -Xmx256m -cp . Main",
    compileTimeoutMs: parseNumber(process.env.JAVA_COMPILE_TIMEOUT_MS, 15_000),
    runTimeoutMs: parseNumber(process.env.JAVA_RUN_TIMEOUT_MS, 20_000),
    traceTimeoutMs: parseNumber(process.env.JAVA_TRACE_TIMEOUT_MS, 6_000),
    memoryLimitMb: Math.max(
      384,
      parseNumber(process.env.JAVA_MEMORY_LIMIT_MB, defaultMemoryLimitMb),
    ),
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
};
