import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import {
  splitOutputLines,
  type ExecutionTrace,
  type SupportedLanguage,
} from "../types/execution";
import { createCompiledLanguageWalkthrough } from "../services/execution/compiledTraceService";
import { languageExecutionConfigs } from "./languageConfigs";
import { removeDirectory } from "../utils/removeDirectory";

const execFileAsync = promisify(execFile);
const dockerBinary = process.env.DOCKER_BIN ?? "docker";
const dockerCommandTimeoutMs = Number(process.env.DOCKER_COMMAND_TIMEOUT_MS ?? 15000);
const executionTimeoutMs = Number(process.env.EXECUTION_TIMEOUT_MS ?? 5000);
const executionMemoryLimit = process.env.EXECUTION_MEMORY_LIMIT ?? "256m";
const executionCpuLimit = process.env.EXECUTION_CPU_LIMIT ?? "0.5";
const executionPidsLimit = process.env.EXECUTION_PIDS_LIMIT ?? "64";

interface ContainerExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const runDockerCommand = async (args: string[]) => {
  try {
    return await execFileAsync(dockerBinary, args, {
      encoding: "utf8",
      timeout: dockerCommandTimeoutMs,
      windowsHide: true,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Docker command failed.";

    throw new Error(
      `Docker execution infrastructure is unavailable. ${message}`,
    );
  }
};

const getContainerExitCode = async (containerName: string) => {
  const { stdout } = await runDockerCommand([
    "inspect",
    "--format",
    "{{.State.ExitCode}}",
    containerName,
  ]);

  return Number(stdout.trim() || "1");
};

const cleanupContainer = async (containerName: string) => {
  try {
    await runDockerCommand(["rm", "-f", containerName]);
  } catch {
    return;
  }
};

const attachToContainer = (containerName: string): Promise<ContainerExecutionResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(dockerBinary, ["start", "-a", containerName], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      stderr = stderr.trim()
        ? `${stderr.trim()}\nExecution timed out after ${executionTimeoutMs}ms.`
        : `Execution timed out after ${executionTimeoutMs}ms.`;
      void cleanupContainer(containerName);
    }, executionTimeoutMs);

    child.once("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(
        new Error(
          `Unable to start Docker execution. ${error.message || "Unknown error."}`,
        ),
      );
    });

    child.once("close", async (code) => {
      clearTimeout(timeoutHandle);

      if (timedOut) {
        resolve({
          stdout,
          stderr,
          exitCode: 124,
          timedOut: true,
        });
        return;
      }

      try {
        const exitCode = await getContainerExitCode(containerName);
        resolve({
          stdout,
          stderr,
          exitCode: Number.isNaN(exitCode) ? code ?? 1 : exitCode,
          timedOut: false,
        });
      } catch (error) {
        reject(error);
      }
    });
  });

const parsePythonTrace = (
  language: SupportedLanguage,
  stdout: string,
  stderr: string,
  executionTime: number,
  timedOut: boolean,
): ExecutionTrace => {
  try {
    const parsed = JSON.parse(stdout) as Partial<ExecutionTrace> & {
      steps?: ExecutionTrace["steps"];
      output?: string;
      error?: string;
    };

    const output = typeof parsed.output === "string" ? parsed.output : "";

    return {
      language,
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      output,
      outputLines: splitOutputLines(output),
      error:
        typeof parsed.error === "string"
          ? parsed.error
          : stderr.trim(),
      executionTime,
      timedOut,
    };
  } catch {
    const output = stdout.trim();

    return {
      language,
      steps: [],
      output,
      outputLines: splitOutputLines(output),
      error:
        stderr.trim() || "Python execution completed, but trace parsing failed.",
      executionTime,
      timedOut,
    };
  }
};

const buildGenericTrace = (
  code: string,
  language: SupportedLanguage,
  stdout: string,
  stderr: string,
  executionTime: number,
  timedOut: boolean,
): ExecutionTrace => {
  const outputLines = splitOutputLines(stdout);
  const steps =
    !stderr.trim() &&
    !timedOut &&
    (language === "c" || language === "cpp" || language === "java")
      ? createCompiledLanguageWalkthrough(code, language, outputLines)
      : [];

  return {
    language,
    steps,
    output: stdout,
    outputLines,
    error: stderr.trim(),
    executionTime,
    timedOut,
  };
};

export const executeInDocker = async (
  code: string,
  language: SupportedLanguage,
): Promise<ExecutionTrace> => {
  const config = languageExecutionConfigs[language];
  const workspaceDir = path.join(
    os.tmpdir(),
    "codesight-executions",
    randomUUID(),
  );
  const containerName = `codesight-${language}-${randomUUID()}`;

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(path.join(workspaceDir, config.fileName), code, "utf8");

  try {
    await runDockerCommand([
      "create",
      "--name",
      containerName,
      "--network",
      "none",
      "--cpus",
      executionCpuLimit,
      "--memory",
      executionMemoryLimit,
      "--pids-limit",
      executionPidsLimit,
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
      "sh",
      "-lc",
      config.command,
    ]);

    const startedAt = performance.now();
    const result = await attachToContainer(containerName);
    const executionTime = Math.round(performance.now() - startedAt);

    if (language === "python") {
      return parsePythonTrace(
        language,
        result.stdout,
        result.stderr,
        executionTime,
        result.timedOut,
      );
    }

    const trace = buildGenericTrace(
      code,
      language,
      result.stdout,
      result.stderr,
      executionTime,
      result.timedOut,
    );

    if (!trace.error && result.exitCode !== 0) {
      trace.error = `Execution failed with exit code ${result.exitCode}.`;
    }

    return trace;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Docker execution error.";
    throw new Error(message);
  } finally {
    await cleanupContainer(containerName);
    await removeDirectory(workspaceDir);
  }
};
