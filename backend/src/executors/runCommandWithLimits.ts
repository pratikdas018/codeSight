import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { StructuredLogger } from "../logging/logger";
import type { ExecutionPhaseName, SupportedLanguage } from "../types/execution";

export interface RunCommandWithLimitsOptions {
  command: string;
  args: string[];
  cwd?: string;
  stdin?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  outputLimitBytes: number;
  onTimeout?: () => void | Promise<void>;
  logger?: StructuredLogger;
  phase?: ExecutionPhaseName | "system";
  language?: SupportedLanguage;
  filePath?: string;
}

export interface RunCommandWithLimitsResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  durationMs: number;
}

const forceKillProcessTree = (
  child: ChildProcessWithoutNullStreams,
  logger?: StructuredLogger,
  context?: {
    phase?: ExecutionPhaseName | "system";
    language?: SupportedLanguage;
    command?: string;
    filePath?: string;
  },
) => {
  if (!child.pid) {
    return;
  }

  try {
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("error", (error) => {
        logger?.warn("Failed to force-kill child process tree on Windows.", context, error);
      });
      return;
    }

    try {
      process.kill(-child.pid, "SIGKILL");
      return;
    } catch {
      process.kill(child.pid, "SIGKILL");
    }
  } catch (error) {
    logger?.warn("Failed to force-kill child process tree.", context, error);
  }
};

export const runCommandWithLimits = (
  options: RunCommandWithLimitsOptions,
): Promise<RunCommandWithLimitsResult> =>
  new Promise((resolve, reject) => {
    const startedAt = performance.now();
    options.logger?.runtime("Spawning child process.", {
      phase: options.phase,
      language: options.language,
      command: [options.command, ...options.args].join(" "),
      filePath: options.filePath,
      details: {
        cwd: options.cwd ?? "",
        timeoutMs: options.timeoutMs,
        stdinBytes: options.stdin ? Buffer.byteLength(options.stdin) : 0,
      },
    });
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutLength = 0;
    let stderrLength = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let finished = false;
    let forceKillHandle: NodeJS.Timeout | null = null;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    const cleanupForceKill = () => {
      if (forceKillHandle) {
        clearTimeout(forceKillHandle);
        forceKillHandle = null;
      }
    };

    const finalize = (result: Omit<RunCommandWithLimitsResult, "durationMs">) => {
      if (finished) {
        return;
      }

      finished = true;
      cleanupForceKill();
      resolve({
        ...result,
        durationMs: Math.round(performance.now() - startedAt),
      });
    };

    const requestTermination = (reason: "timeout" | "output_limit") => {
      if (finished || child.killed) {
        return;
      }

      try {
        if (process.platform === "win32") {
          child.kill();
        } else {
          child.kill("SIGTERM");
        }
      } catch (error) {
        options.logger?.warn("Failed to request child process termination.", {
          phase: options.phase,
          language: options.language,
          command: [options.command, ...options.args].join(" "),
          filePath: options.filePath,
          details: {
            reason,
          },
        }, error);
      }

      cleanupForceKill();
      forceKillHandle = setTimeout(() => {
        forceKillProcessTree(child, options.logger, {
          phase: options.phase,
          language: options.language,
          command: [options.command, ...options.args].join(" "),
          filePath: options.filePath,
        });
      }, 750);
    };

    const stopForBufferLimit = () => {
      outputLimitExceeded = true;
      stderr = stderr.trim()
        ? `${stderr.trim()}\nOutput exceeded ${options.outputLimitBytes} bytes and was truncated.`
        : `Output exceeded ${options.outputLimitBytes} bytes and was truncated.`;
      options.logger?.warn("Child process output limit exceeded.", {
        phase: options.phase,
        language: options.language,
        command: [options.command, ...options.args].join(" "),
        filePath: options.filePath,
        stdout,
        stderr,
        details: {
          outputLimitBytes: options.outputLimitBytes,
        },
      });
      requestTermination("output_limit");
    };

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      stdoutLength += Buffer.byteLength(chunk);

      if (stdoutLength + stderrLength > options.outputLimitBytes) {
        stopForBufferLimit();
      }
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      stderrLength += Buffer.byteLength(chunk);

      if (stdoutLength + stderrLength > options.outputLimitBytes) {
        stopForBufferLimit();
      }
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      options.logger?.warn("Child process timed out.", {
        phase: options.phase,
        language: options.language,
        command: [options.command, ...options.args].join(" "),
        filePath: options.filePath,
        stdout,
        stderr,
        details: {
          timeoutMs: options.timeoutMs,
        },
      });
      void options.onTimeout?.();
      requestTermination("timeout");
    }, options.timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timeoutHandle);
      cleanupForceKill();
      options.logger?.error("Child process failed to spawn.", error, {
        phase: options.phase,
        language: options.language,
        command: [options.command, ...options.args].join(" "),
        filePath: options.filePath,
        stdout,
        stderr,
      });
      reject(error);
    });

    if (options.stdin) {
      child.stdin.write(options.stdin, (error) => {
        if (!error) {
          return;
        }

        options.logger?.warn("Failed while streaming stdin to child process.", {
          phase: options.phase,
          language: options.language,
          command: [options.command, ...options.args].join(" "),
          filePath: options.filePath,
          details: {
            stdinBytes: Buffer.byteLength(options.stdin ?? "", "utf8"),
          },
        }, error);
      });
    }
    child.stdin.end();

    child.once("close", (code, signal) => {
      clearTimeout(timeoutHandle);
       cleanupForceKill();
      options.logger?.runtime("Child process finished.", {
        phase: options.phase,
        language: options.language,
        command: [options.command, ...options.args].join(" "),
        filePath: options.filePath,
        durationMs: Math.round(performance.now() - startedAt),
        exitCode: code,
        signal,
        stdout,
        stderr,
        details: {
          timedOut,
          outputLimitExceeded,
        },
      });
      finalize({
        stdout,
        stderr,
        exitCode: code,
        signal,
        timedOut,
        outputLimitExceeded,
      });
    });
  });
