import { execFile } from "node:child_process";
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
import { executeJavaScript } from "../services/execution/javascriptTraceService";
import { executePython } from "../services/execution/pythonTraceService";
import { removeDirectory } from "../utils/removeDirectory";

const execFileAsync = promisify(execFile);
const executionTimeoutMs = Number(process.env.EXECUTION_TIMEOUT_MS ?? 5000);
const maxBuffer = 1024 * 1024;

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

const runWithCandidates = async (
  candidates: CommandCandidate[],
  args: string[],
  cwd?: string,
) => {
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return await execFileAsync(
        candidate.command,
        [...(candidate.args ?? []), ...args],
        {
          cwd,
          timeout: executionTimeoutMs,
          maxBuffer,
          encoding: "utf8",
          windowsHide: true,
        },
      );
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

const buildTrace = (
  code: string,
  language: SupportedLanguage,
  stdout: string,
  stderr: string,
  executionTime: number,
  steps: ExecutionTrace["steps"] = [],
  timedOut = false,
): ExecutionTrace => {
  const outputLines = splitOutputLines(stdout);
  const compiledLanguageWalkthrough =
    steps.length === 0 &&
    !stderr.trim() &&
    !timedOut &&
    (language === "c" || language === "cpp" || language === "java")
      ? createCompiledLanguageWalkthrough(code, language, outputLines)
      : steps;

  return {
    language,
    steps: compiledLanguageWalkthrough,
    output: stdout,
    outputLines,
    error: stderr.trim(),
    executionTime,
    timedOut,
  };
};

const getNodeCandidates = (): CommandCandidate[] => [
  { command: process.execPath },
  { command: "node" },
];

const getPythonCandidates = (): CommandCandidate[] => [
  { command: "python" },
  { command: "py", args: ["-3"] },
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

const normalizeExecError = (
  sourceCode: string,
  language: SupportedLanguage,
  error: unknown,
  executionTime: number,
): ExecutionTrace => {
  const stdout =
    typeof error === "object" &&
    error !== null &&
    "stdout" in error &&
    typeof (error as { stdout?: string }).stdout === "string"
      ? (error as { stdout: string }).stdout
      : "";
  const stderrFromProcess =
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof (error as { stderr?: string }).stderr === "string"
      ? (error as { stderr: string }).stderr
      : "";
  const fallbackMessage =
    error instanceof Error ? error.message : "Execution failed.";
  const stderr = stderrFromProcess.trim() || fallbackMessage;
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: string | number }).code !== "undefined"
      ? (error as { code?: string | number }).code
      : "";
  const timedOut = code === "ETIMEDOUT" || code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
  const normalizedErrorMessage = String(stderr);
  const runtimeMessage =
    language === "java" &&
    /not recognized|ENOENT|Required runtime is not installed/i.test(normalizedErrorMessage)
      ? "Java runtime not found. Install a JDK and set JAVA_HOME, or add java/javac to PATH."
      : language === "c" &&
          /not recognized|ENOENT|Required runtime is not installed/i.test(normalizedErrorMessage)
        ? "C compiler not found. Install gcc or add it to PATH."
        : language === "cpp" &&
            /not recognized|ENOENT|Required runtime is not installed/i.test(normalizedErrorMessage)
          ? "C++ compiler not found. Install g++ or add it to PATH."
          : normalizedErrorMessage;

  const finalError = timedOut
    ? `Execution timed out after ${executionTimeoutMs}ms.`
    : runtimeMessage;
  const shouldProvideWalkthroughFallback =
    !timedOut &&
    sourceCode.trim().length > 0 &&
    (language === "c" || language === "cpp" || language === "java") &&
    /runtime not found|compiler not found/i.test(finalError);

  return {
    language,
    steps: shouldProvideWalkthroughFallback
      ? createCompiledLanguageWalkthrough(sourceCode, language, [])
      : [],
    output: stdout,
    outputLines: splitOutputLines(stdout),
    error: finalError,
    executionTime,
    timedOut,
  };
};

const executeJavaScriptLocally = async (code: string): Promise<ExecutionTrace> => {
  const workspaceDir = path.join(os.tmpdir(), "codesight-js", randomUUID());
  const filePath = path.join(workspaceDir, "main.js");
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(filePath, code, "utf8");

  const startedAt = performance.now();

  try {
    const [{ stdout, stderr }, timeline] = await Promise.all([
      runWithCandidates(getNodeCandidates(), [filePath], workspaceDir),
      Promise.resolve(executeJavaScript(code)),
    ]);

    return buildTrace(
      code,
      "javascript",
      stdout,
      stderr,
      Math.round(performance.now() - startedAt),
      timeline.steps,
    );
  } catch (error) {
    return normalizeExecError(
      code,
      "javascript",
      error,
      Math.round(performance.now() - startedAt),
    );
  } finally {
    await removeDirectory(workspaceDir);
  }
};

const executePythonLocally = async (code: string): Promise<ExecutionTrace> => {
  const startedAt = performance.now();

  try {
    const timeline = await executePython(code);
    const output = timeline.output.join("\n");

    return buildTrace(
      code,
      "python",
      output,
      timeline.error ?? "",
      Math.round(performance.now() - startedAt),
      timeline.steps,
    );
  } catch (error) {
    return normalizeExecError(
      code,
      "python",
      error,
      Math.round(performance.now() - startedAt),
    );
  }
};

const compileAndRunLocally = async (
  language: "c" | "cpp",
  code: string,
): Promise<ExecutionTrace> => {
  const workspaceDir = path.join(os.tmpdir(), `codesight-${language}`, randomUUID());
  const sourceFile = path.join(workspaceDir, language === "c" ? "main.c" : "main.cpp");
  const outputFile = path.join(workspaceDir, process.platform === "win32" ? "program.exe" : "program");
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(sourceFile, code, "utf8");

  const startedAt = performance.now();

  try {
    await runWithCandidates(
      language === "c" ? getGccCandidates() : getGppCandidates(),
      [sourceFile, "-O2", language === "c" ? "-std=c11" : "-std=c++17", "-o", outputFile],
      workspaceDir,
    );

    const { stdout, stderr } = await execFileAsync(outputFile, [], {
      cwd: workspaceDir,
      timeout: executionTimeoutMs,
      maxBuffer,
      encoding: "utf8",
      windowsHide: true,
    });

    return buildTrace(
      code,
      language,
      stdout,
      stderr,
      Math.round(performance.now() - startedAt),
    );
  } catch (error) {
    return normalizeExecError(
      code,
      language,
      error,
      Math.round(performance.now() - startedAt),
    );
  } finally {
    await removeDirectory(workspaceDir);
  }
};

const executeJavaLocally = async (code: string): Promise<ExecutionTrace> => {
  const workspaceDir = path.join(os.tmpdir(), "codesight-java", randomUUID());
  const sourceFile = path.join(workspaceDir, "Main.java");
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(sourceFile, code, "utf8");

  const startedAt = performance.now();

  try {
    await runWithCandidates(getJavacCandidates(), [sourceFile], workspaceDir);
    const { stdout, stderr } = await runWithCandidates(
      getJavaCandidates(),
      ["-cp", workspaceDir, "Main"],
      workspaceDir,
    );

    return buildTrace(
      code,
      "java",
      stdout,
      stderr,
      Math.round(performance.now() - startedAt),
    );
  } catch (error) {
    return normalizeExecError(
      code,
      "java",
      error,
      Math.round(performance.now() - startedAt),
    );
  } finally {
    await removeDirectory(workspaceDir);
  }
};

export const executeLocally = async (
  code: string,
  language: SupportedLanguage,
): Promise<ExecutionTrace> => {
  switch (language) {
    case "javascript":
      return executeJavaScriptLocally(code);
    case "python":
      return executePythonLocally(code);
    case "c":
      return compileAndRunLocally("c", code);
    case "cpp":
      return compileAndRunLocally("cpp", code);
    case "java":
      return executeJavaLocally(code);
  }
};
