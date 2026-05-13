import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  splitOutputLines,
  type ExecutionPhaseResult,
  type ExecutionTrace,
  type SupportedLanguage,
} from "../types/execution";
import { createCompiledLanguageWalkthrough } from "../services/execution/compiledTraceService";
import { executeJavaScript } from "../services/execution/javascriptTraceService";
import { executePython } from "../services/execution/pythonTraceService";
import {
  executionInfrastructureConfig,
  languageExecutionConfigs,
} from "./languageConfigs";
import { createTraceSkeleton, finalizeTrace, setPhase, summarizeStdin } from "./runtimeTrace";
import { runCommandWithLimits } from "./runCommandWithLimits";
import { removeDirectory } from "../utils/removeDirectory";

interface CommandCandidate {
  command: string;
  args?: string[];
}

const buildConfiguredCandidates = (value?: string | null): CommandCandidate[] => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return [];
  }

  const [command, ...args] = normalizedValue.split(/\s+/);
  return [{ command, args }];
};

const getJavaHomeBinCandidate = (binaryName: "java" | "javac") => {
  const javaHome = process.env.JAVA_HOME?.trim();

  if (!javaHome) {
    return [];
  }

  const executable =
    process.platform === "win32"
      ? path.join(javaHome, "bin", `${binaryName}.exe`)
      : path.join(javaHome, "bin", binaryName);

  return [{ command: executable }];
};

const getNodeCandidates = (): CommandCandidate[] => [
  { command: process.execPath },
  { command: "node" },
];

const getGccCandidates = (): CommandCandidate[] => [{ command: "gcc" }];
const getGppCandidates = (): CommandCandidate[] => [{ command: "g++" }];
const getJavacCandidates = (): CommandCandidate[] => [
  ...buildConfiguredCandidates(process.env.JAVAC_EXECUTABLE),
  ...getJavaHomeBinCandidate("javac"),
  { command: "javac" },
];
const getJavaCandidates = (): CommandCandidate[] => [
  ...buildConfiguredCandidates(process.env.JAVA_EXECUTABLE),
  ...getJavaHomeBinCandidate("java"),
  { command: "java" },
];

const createPhaseResult = (
  phase: "compile" | "run",
  command: string,
  result: Awaited<ReturnType<typeof runCommandWithLimits>>,
): ExecutionPhaseResult => ({
  phase,
  command,
  stdout: result.stdout,
  stderr: result.stderr,
  exitCode: result.exitCode,
  durationMs: result.durationMs,
  timedOut: result.timedOut,
  status: result.timedOut
    ? "timed_out"
    : result.exitCode === 0 && !result.outputLimitExceeded
      ? "completed"
      : "failed",
});

const runWithCandidates = async (
  candidates: CommandCandidate[],
  args: string[],
  cwd: string | undefined,
  stdin: string,
  timeoutMs: number,
) => {
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const result = await runCommandWithLimits({
        command: candidate.command,
        args: [...(candidate.args ?? []), ...args],
        cwd,
        stdin,
        timeoutMs,
        outputLimitBytes: executionInfrastructureConfig.outputBufferBytes,
      });
      return {
        command: [candidate.command, ...(candidate.args ?? []), ...args].join(" "),
        result,
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT"
      ) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Required runtime is not installed.");
};

const applyInfrastructureFailure = (
  trace: ExecutionTrace,
  phase: "compile" | "run",
  command: string,
  error: unknown,
  durationMs: number,
) => {
  const message = error instanceof Error ? error.message : "Execution failed.";
  setPhase(trace, phase, {
    phase,
    command,
    stdout: "",
    stderr: message,
    exitCode: null,
    durationMs,
    timedOut: false,
    status: "failed",
  });
};

const executeJavaScriptLocally = async (
  code: string,
  stdin = "",
  queueTimeMs = 0,
): Promise<ExecutionTrace> => {
  const config = languageExecutionConfigs.javascript;
  const limits = {
    queueConcurrency: executionInfrastructureConfig.queueConcurrency,
    queueDepthLimit: executionInfrastructureConfig.queueDepthLimit,
    compileTimeoutMs: config.compileTimeoutMs,
    runTimeoutMs: config.runTimeoutMs,
    memoryLimitMb: config.memoryLimitMb,
    cpuLimit: config.cpuLimit,
    pidsLimit: config.pidsLimit,
  };
  const trace = createTraceSkeleton(
    "javascript",
    limits,
    summarizeStdin(stdin),
    queueTimeMs,
  );
  const workspaceDir = path.join(os.tmpdir(), "codesight-js", randomUUID());
  const filePath = path.join(workspaceDir, "main.js");

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(filePath, code, "utf8");

  try {
    const { command, result } = await runWithCandidates(
      getNodeCandidates(),
      [filePath],
      workspaceDir,
      stdin,
      config.runTimeoutMs,
    );
    const runPhase = createPhaseResult("run", command, result);
    setPhase(trace, "run", runPhase);
    trace.output = runPhase.stdout;
    trace.outputLines = splitOutputLines(runPhase.stdout);
    trace.steps =
      runPhase.status === "completed" && stdin.trim().length === 0
        ? executeJavaScript(code).steps
        : [];
    return finalizeTrace(trace, "javascript");
  } catch (error) {
    applyInfrastructureFailure(trace, "run", config.runCommand, error, 0);
    return finalizeTrace(trace, "javascript");
  } finally {
    await removeDirectory(workspaceDir);
  }
};

const executePythonLocally = async (
  code: string,
  stdin = "",
  queueTimeMs = 0,
): Promise<ExecutionTrace> => {
  const config = languageExecutionConfigs.python;
  const limits = {
    queueConcurrency: executionInfrastructureConfig.queueConcurrency,
    queueDepthLimit: executionInfrastructureConfig.queueDepthLimit,
    compileTimeoutMs: config.compileTimeoutMs,
    runTimeoutMs: config.runTimeoutMs,
    memoryLimitMb: config.memoryLimitMb,
    cpuLimit: config.cpuLimit,
    pidsLimit: config.pidsLimit,
  };
  const trace = createTraceSkeleton(
    "python",
    limits,
    summarizeStdin(stdin),
    queueTimeMs,
  );

  try {
    const startedAt = performance.now();
    const timeline = await executePython(code, stdin, config.runTimeoutMs);
    const output = timeline.output.join("\n");
    const durationMs = Math.round(performance.now() - startedAt);
    setPhase(trace, "run", {
      phase: "run",
      command: config.runCommand,
      stdout: output,
      stderr: timeline.error ?? "",
      exitCode: timeline.error ? 1 : 0,
      durationMs,
      timedOut: false,
      status: timeline.error ? "failed" : "completed",
    });
    trace.steps = timeline.steps;
    trace.output = output;
    trace.outputLines = splitOutputLines(output);
    return finalizeTrace(trace, "python", {
      runTimeMs: trace.phases.run?.durationMs ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Python execution failed.";
    setPhase(trace, "run", {
      phase: "run",
      command: config.runCommand,
      stdout: "",
      stderr: message,
      exitCode: null,
      durationMs: 0,
      timedOut: /timed out/i.test(message),
      status: /timed out/i.test(message) ? "timed_out" : "failed",
    });
    return finalizeTrace(trace, "python");
  }
};

const compileAndRunLocally = async (
  language: "c" | "cpp",
  code: string,
  stdin = "",
  queueTimeMs = 0,
): Promise<ExecutionTrace> => {
  const config = languageExecutionConfigs[language];
  const limits = {
    queueConcurrency: executionInfrastructureConfig.queueConcurrency,
    queueDepthLimit: executionInfrastructureConfig.queueDepthLimit,
    compileTimeoutMs: config.compileTimeoutMs,
    runTimeoutMs: config.runTimeoutMs,
    memoryLimitMb: config.memoryLimitMb,
    cpuLimit: config.cpuLimit,
    pidsLimit: config.pidsLimit,
  };
  const trace = createTraceSkeleton(
    language,
    limits,
    summarizeStdin(stdin),
    queueTimeMs,
  );
  const workspaceDir = path.join(os.tmpdir(), `codesight-${language}`, randomUUID());
  const sourceFile = path.join(workspaceDir, config.fileName);
  const outputFile = path.join(
    workspaceDir,
    process.platform === "win32" ? "program.exe" : "program",
  );

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(sourceFile, code, "utf8");

  try {
    const compileArgs =
      language === "c"
        ? [sourceFile, "-O2", "-pipe", "-std=c11", "-o", outputFile]
        : [sourceFile, "-O2", "-pipe", "-std=c++17", "-o", outputFile];
    const compileCandidate = await runWithCandidates(
      language === "c" ? getGccCandidates() : getGppCandidates(),
      compileArgs,
      workspaceDir,
      "",
      config.compileTimeoutMs,
    );
    const compilePhase = createPhaseResult(
      "compile",
      compileCandidate.command,
      compileCandidate.result,
    );
    setPhase(trace, "compile", compilePhase);

    if (compilePhase.status !== "completed") {
      return finalizeTrace(trace, language);
    }

    const runResult = await runCommandWithLimits({
      command: outputFile,
      args: [],
      cwd: workspaceDir,
      stdin,
      timeoutMs: config.runTimeoutMs,
      outputLimitBytes: executionInfrastructureConfig.outputBufferBytes,
    });
    const runPhase = createPhaseResult("run", outputFile, runResult);
    setPhase(trace, "run", runPhase);
    trace.output = runPhase.stdout;
    trace.outputLines = splitOutputLines(runPhase.stdout);
    trace.steps =
      runPhase.status === "completed"
        ? createCompiledLanguageWalkthrough(code, language, trace.outputLines)
        : [];
    return finalizeTrace(trace, language);
  } catch (error) {
    const phase = trace.phases.compile ? "run" : "compile";
    applyInfrastructureFailure(
      trace,
      phase,
      phase === "compile" ? config.compileCommand ?? "" : outputFile,
      error,
      0,
    );
    return finalizeTrace(trace, language);
  } finally {
    await removeDirectory(workspaceDir);
  }
};

const executeJavaLocally = async (
  code: string,
  stdin = "",
  queueTimeMs = 0,
): Promise<ExecutionTrace> => {
  const config = languageExecutionConfigs.java;
  const limits = {
    queueConcurrency: executionInfrastructureConfig.queueConcurrency,
    queueDepthLimit: executionInfrastructureConfig.queueDepthLimit,
    compileTimeoutMs: config.compileTimeoutMs,
    runTimeoutMs: config.runTimeoutMs,
    memoryLimitMb: config.memoryLimitMb,
    cpuLimit: config.cpuLimit,
    pidsLimit: config.pidsLimit,
  };
  const trace = createTraceSkeleton(
    "java",
    limits,
    summarizeStdin(stdin),
    queueTimeMs,
  );
  const workspaceDir = path.join(os.tmpdir(), "codesight-java", randomUUID());
  const sourceFile = path.join(workspaceDir, "Main.java");

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(sourceFile, code, "utf8");

  try {
    const compileCandidate = await runWithCandidates(
      getJavacCandidates(),
      [sourceFile],
      workspaceDir,
      "",
      config.compileTimeoutMs,
    );
    const compilePhase = createPhaseResult(
      "compile",
      compileCandidate.command,
      compileCandidate.result,
    );
    setPhase(trace, "compile", compilePhase);

    if (compilePhase.status !== "completed") {
      return finalizeTrace(trace, "java");
    }

    const runCandidate = await runWithCandidates(
      getJavaCandidates(),
      ["-cp", workspaceDir, "Main"],
      workspaceDir,
      stdin,
      config.runTimeoutMs,
    );
    const runPhase = createPhaseResult(
      "run",
      runCandidate.command,
      runCandidate.result,
    );
    setPhase(trace, "run", runPhase);
    trace.output = runPhase.stdout;
    trace.outputLines = splitOutputLines(runPhase.stdout);
    trace.steps =
      runPhase.status === "completed"
        ? createCompiledLanguageWalkthrough(code, "java", trace.outputLines)
        : [];
    return finalizeTrace(trace, "java");
  } catch (error) {
    const phase = trace.phases.compile ? "run" : "compile";
    applyInfrastructureFailure(
      trace,
      phase,
      phase === "compile" ? config.compileCommand ?? "" : config.runCommand,
      error,
      0,
    );
    return finalizeTrace(trace, "java");
  } finally {
    await removeDirectory(workspaceDir);
  }
};

export const executeLocally = async (
  code: string,
  language: SupportedLanguage,
  stdin = "",
  queueTimeMs = 0,
): Promise<ExecutionTrace> => {
  switch (language) {
    case "javascript":
      return executeJavaScriptLocally(code, stdin, queueTimeMs);
    case "python":
      return executePythonLocally(code, stdin, queueTimeMs);
    case "c":
      return compileAndRunLocally("c", code, stdin, queueTimeMs);
    case "cpp":
      return compileAndRunLocally("cpp", code, stdin, queueTimeMs);
    case "java":
      return executeJavaLocally(code, stdin, queueTimeMs);
  }
};
