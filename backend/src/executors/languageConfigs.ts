import type { SupportedLanguage } from "../types/execution";

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export interface LanguageExecutionConfig {
  image: string;
  fileName: string;
  compileCommand?: string;
  runCommand: string;
  compileTimeoutMs: number;
  runTimeoutMs: number;
  memoryLimitMb: number;
  cpuLimit: number;
  pidsLimit: number;
}

export interface ExecutionInfrastructureConfig {
  dockerBinary: string;
  dockerCommandTimeoutMs: number;
  queueConcurrency: number;
  queueDepthLimit: number;
  outputBufferBytes: number;
}

const imageNames = {
  node: process.env.NODE_EXECUTOR_IMAGE ?? "codesight-node-runner",
  python: process.env.PYTHON_EXECUTOR_IMAGE ?? "codesight-python-runner",
  cpp: process.env.CPP_EXECUTOR_IMAGE ?? "codesight-cpp-runner",
  java: process.env.JAVA_EXECUTOR_IMAGE ?? "codesight-java-runner",
};

const defaultMemoryLimitMb = parseNumber(
  process.env.EXECUTION_MEMORY_LIMIT_MB,
  512,
);
const defaultCpuLimit = parseNumber(process.env.EXECUTION_CPU_LIMIT, 1);
const defaultPidsLimit = parseNumber(process.env.EXECUTION_PIDS_LIMIT, 128);

export const executionInfrastructureConfig: ExecutionInfrastructureConfig = {
  dockerBinary: process.env.DOCKER_BIN ?? "docker",
  dockerCommandTimeoutMs: parseNumber(
    process.env.DOCKER_COMMAND_TIMEOUT_MS,
    20_000,
  ),
  queueConcurrency: Math.max(
    1,
    parseNumber(process.env.EXECUTION_QUEUE_CONCURRENCY, 2),
  ),
  queueDepthLimit: Math.max(
    1,
    parseNumber(process.env.EXECUTION_QUEUE_DEPTH_LIMIT, 50),
  ),
  outputBufferBytes: Math.max(
    64 * 1024,
    parseNumber(process.env.EXECUTION_MAX_OUTPUT_BYTES, 1024 * 1024),
  ),
};

export const languageExecutionConfigs: Record<
  SupportedLanguage,
  LanguageExecutionConfig
> = {
  javascript: {
    image: imageNames.node,
    fileName: "main.js",
    runCommand: "node /workspace/main.js",
    compileTimeoutMs: 1_000,
    runTimeoutMs: parseNumber(process.env.JAVASCRIPT_RUN_TIMEOUT_MS, 10_000),
    memoryLimitMb: defaultMemoryLimitMb,
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
  python: {
    image: imageNames.python,
    fileName: "main.py",
    runCommand: "python3 /opt/codesight/python_trace.py /workspace/main.py",
    compileTimeoutMs: 1_000,
    runTimeoutMs: parseNumber(process.env.PYTHON_RUN_TIMEOUT_MS, 10_000),
    memoryLimitMb: defaultMemoryLimitMb,
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
  c: {
    image: imageNames.cpp,
    fileName: "main.c",
    compileCommand:
      "gcc /workspace/main.c -O2 -pipe -std=c11 -o /workspace/program",
    runCommand: "/workspace/program",
    compileTimeoutMs: parseNumber(process.env.C_COMPILE_TIMEOUT_MS, 12_000),
    runTimeoutMs: parseNumber(process.env.C_RUN_TIMEOUT_MS, 15_000),
    memoryLimitMb: defaultMemoryLimitMb,
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
  cpp: {
    image: imageNames.cpp,
    fileName: "main.cpp",
    compileCommand:
      "g++ /workspace/main.cpp -O2 -pipe -std=c++17 -o /workspace/program",
    runCommand: "/workspace/program",
    compileTimeoutMs: parseNumber(process.env.CPP_COMPILE_TIMEOUT_MS, 12_000),
    runTimeoutMs: parseNumber(process.env.CPP_RUN_TIMEOUT_MS, 15_000),
    memoryLimitMb: defaultMemoryLimitMb,
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
  java: {
    image: imageNames.java,
    fileName: "Main.java",
    compileCommand: "javac /workspace/Main.java",
    runCommand: "java -Xms64m -Xmx256m -cp /workspace Main",
    compileTimeoutMs: parseNumber(process.env.JAVA_COMPILE_TIMEOUT_MS, 15_000),
    runTimeoutMs: parseNumber(process.env.JAVA_RUN_TIMEOUT_MS, 20_000),
    memoryLimitMb: Math.max(
      384,
      parseNumber(process.env.JAVA_MEMORY_LIMIT_MB, defaultMemoryLimitMb),
    ),
    cpuLimit: defaultCpuLimit,
    pidsLimit: defaultPidsLimit,
  },
};
