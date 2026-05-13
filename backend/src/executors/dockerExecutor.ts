import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import {
  splitOutputLines,
  type ExecutionPhaseResult,
  type ExecutionTrace,
  type SupportedLanguage,
} from "../types/execution";
import { createCompiledLanguageWalkthrough } from "../services/execution/compiledTraceService";
import {
  executionInfrastructureConfig,
  languageExecutionConfigs,
} from "./languageConfigs";
import { createTraceSkeleton, finalizeTrace, setPhase, summarizeStdin } from "./runtimeTrace";
import { runCommandWithLimits } from "./runCommandWithLimits";
import { removeDirectory } from "../utils/removeDirectory";

const execFileAsync = promisify(execFile);

interface ParsedPythonTrace {
  steps?: ExecutionTrace["steps"];
  output?: string;
  error?: string;
}

const runDockerCli = async (args: string[]) => {
  try {
    return await execFileAsync(executionInfrastructureConfig.dockerBinary, args, {
      encoding: "utf8",
      timeout: executionInfrastructureConfig.dockerCommandTimeoutMs,
      windowsHide: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Docker command failed.";
    throw new Error(`Docker execution infrastructure is unavailable. ${message}`);
  }
};

const cleanupContainer = async (containerName: string) => {
  try {
    await runDockerCli(["rm", "-f", containerName]);
  } catch {
    return;
  }
};

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

const executeContainerPhase = async (
  containerName: string,
  phase: "compile" | "run",
  command: string,
  timeoutMs: number,
  stdin = "",
) => {
  const result = await runCommandWithLimits({
    command: executionInfrastructureConfig.dockerBinary,
    args: ["exec", "-i", containerName, "sh", "-lc", command],
    stdin,
    timeoutMs,
    outputLimitBytes: executionInfrastructureConfig.outputBufferBytes,
    onTimeout: () => cleanupContainer(containerName),
  });

  return createPhaseResult(phase, command, result);
};

const parsePythonTrace = (
  phase: ExecutionPhaseResult,
): {
  output: string;
  outputLines: string[];
  steps: ExecutionTrace["steps"];
} => {
  try {
    const parsed = JSON.parse(phase.stdout) as ParsedPythonTrace;
    const output = typeof parsed.output === "string" ? parsed.output : "";
    phase.stdout = output;

    if (typeof parsed.error === "string" && parsed.error.trim()) {
      phase.stderr = parsed.error;
      phase.status = "failed";
    }

    return {
      output,
      outputLines: splitOutputLines(output),
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    };
  } catch {
    return {
      output: phase.stdout,
      outputLines: splitOutputLines(phase.stdout),
      steps: [],
    };
  }
};

const readPeakMemoryBytes = async (containerName: string) => {
  try {
    const { stdout } = await runDockerCli([
      "exec",
      containerName,
      "sh",
      "-lc",
      "cat /sys/fs/cgroup/memory.peak 2>/dev/null || cat /sys/fs/cgroup/memory.max_usage_in_bytes 2>/dev/null || echo ''",
    ]);
    const value = Number(stdout.trim());
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

export const executeInDocker = async (
  code: string,
  language: SupportedLanguage,
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
  const workspaceDir = path.join(
    os.tmpdir(),
    "codesight-executions",
    randomUUID(),
  );
  const containerName = `codesight-${language}-${randomUUID()}`;

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(path.join(workspaceDir, config.fileName), code, "utf8");

  try {
    await runDockerCli([
      "create",
      "--name",
      containerName,
      "--network",
      "none",
      "--cpus",
      String(config.cpuLimit),
      "--memory",
      `${config.memoryLimitMb}m`,
      "--pids-limit",
      String(config.pidsLimit),
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=64m",
      "--security-opt",
      "no-new-privileges",
      "--cap-drop",
      "ALL",
      "--workdir",
      "/workspace",
      "--mount",
      `type=bind,source=${workspaceDir},target=/workspace`,
      config.image,
      "tail",
      "-f",
      "/dev/null",
    ]);
    await runDockerCli(["start", containerName]);

    if (config.compileCommand) {
      const compilePhase = await executeContainerPhase(
        containerName,
        "compile",
        config.compileCommand,
        config.compileTimeoutMs,
      );
      setPhase(trace, "compile", compilePhase);

      if (compilePhase.status !== "completed") {
        const peakMemoryBytes = await readPeakMemoryBytes(containerName);
        trace.output = "";
        trace.outputLines = [];
        return finalizeTrace(trace, language, {
          peakMemoryBytes,
          peakMemoryKb:
            typeof peakMemoryBytes === "number"
              ? Math.round(peakMemoryBytes / 1024)
              : null,
        });
      }
    }

    const runPhase = await executeContainerPhase(
      containerName,
      "run",
      config.runCommand,
      config.runTimeoutMs,
      stdin,
    );
    setPhase(trace, "run", runPhase);

    if (language === "python") {
      const parsed = parsePythonTrace(runPhase);
      trace.steps = parsed.steps;
      trace.output = parsed.output;
      trace.outputLines = parsed.outputLines;
    } else {
      trace.output = runPhase.stdout;
      trace.outputLines = splitOutputLines(runPhase.stdout);
      trace.steps =
        runPhase.status === "completed" &&
        (language === "c" || language === "cpp" || language === "java")
          ? createCompiledLanguageWalkthrough(code, language, trace.outputLines)
          : [];
    }

    const peakMemoryBytes = await readPeakMemoryBytes(containerName);
    return finalizeTrace(trace, language, {
      peakMemoryBytes,
      peakMemoryKb:
        typeof peakMemoryBytes === "number"
          ? Math.round(peakMemoryBytes / 1024)
          : null,
    });
  } finally {
    await cleanupContainer(containerName);
    await removeDirectory(workspaceDir);
  }
};
