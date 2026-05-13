import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

export interface RunCommandWithLimitsOptions {
  command: string;
  args: string[];
  cwd?: string;
  stdin?: string;
  timeoutMs: number;
  outputLimitBytes: number;
  onTimeout?: () => void | Promise<void>;
}

export interface RunCommandWithLimitsResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  durationMs: number;
}

export const runCommandWithLimits = (
  options: RunCommandWithLimitsOptions,
): Promise<RunCommandWithLimitsResult> =>
  new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
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

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    const finalize = (result: Omit<RunCommandWithLimitsResult, "durationMs">) => {
      if (finished) {
        return;
      }

      finished = true;
      resolve({
        ...result,
        durationMs: Math.round(performance.now() - startedAt),
      });
    };

    const stopForBufferLimit = () => {
      outputLimitExceeded = true;
      stderr = stderr.trim()
        ? `${stderr.trim()}\nOutput exceeded ${options.outputLimitBytes} bytes and was truncated.`
        : `Output exceeded ${options.outputLimitBytes} bytes and was truncated.`;
      child.kill();
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
      void options.onTimeout?.();
      child.kill();
    }, options.timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();

    child.once("close", (code) => {
      clearTimeout(timeoutHandle);
      finalize({
        stdout,
        stderr,
        exitCode: code,
        timedOut,
        outputLimitExceeded,
      });
    });
  });
