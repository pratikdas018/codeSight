import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createStructuredLogger, type StructuredLogger } from "../logging/logger";
import { removeDirectory } from "../utils/removeDirectory";
import {
  splitOutputLines,
  type ExecutionPhaseName,
  type ExecutionPhaseResult,
  type ExecutionTimeline,
  type ExecutionTrace,
  type SupportedLanguage,
} from "../types/execution";
import { createCompiledLanguageWalkthrough } from "../services/execution/compiledTraceService";
import { executeJavaScript } from "../services/execution/javascriptTraceService";
import { executePython } from "../services/execution/pythonTraceService";
import { materializeTraceFrames } from "../services/execution/traceFrameService";
import { createExecutionModePlan } from "./executionMode";
import {
  executionInfrastructureConfig,
  languageExecutionConfigs,
} from "./languageConfigs";
import {
  type CommandCandidate,
  getGccCandidates,
  getGppCandidates,
  getJavaCandidates,
  getJavacCandidates,
  getNodeCandidates,
  getPythonCandidates,
} from "./runtimeCatalog";
import {
  createPhaseResult,
  createSkippedPhaseResult,
  createSyntheticPhaseFailure,
} from "./phaseResults";
import { createTraceSkeleton, finalizeTrace, setPhase, summarizeStdin } from "./runtimeTrace";
import {
  runCommandWithLimits,
  type RunCommandWithLimitsResult,
} from "./runCommandWithLimits";

interface RunWithCandidatesOptions {
  candidates: CommandCandidate[];
  args: string[];
  cwd?: string;
  stdin: string;
  timeoutMs: number;
  missingMessage: string;
  logger?: StructuredLogger;
  phase?: ExecutionPhaseName;
  language?: SupportedLanguage;
  filePath?: string;
  env?: NodeJS.ProcessEnv;
  shouldTreatResultAsMissing?: (
    candidate: CommandCandidate,
    result: RunCommandWithLimitsResult,
  ) => boolean;
}

interface RunWithCandidatesSuccess {
  command: string;
  result: RunCommandWithLimitsResult;
}

interface JavaLayout {
  sourceFile: string;
  compileTarget: string;
  runClassName: string;
}

const pythonWindowsStoreAliasPattern =
  /Python was not found; run without arguments to install from the Microsoft Store/i;

const buildLimits = (
  language: SupportedLanguage,
  traceTimeoutMsOverride?: number,
) => {
  const config = languageExecutionConfigs[language];
  return {
    queueConcurrency: executionInfrastructureConfig.queueConcurrency,
    queueDepthLimit: executionInfrastructureConfig.queueDepthLimit,
    compileTimeoutMs: config.compileTimeoutMs,
    runTimeoutMs: config.runTimeoutMs,
    traceTimeoutMs: traceTimeoutMsOverride ?? config.traceTimeoutMs,
    memoryLimitMb: config.memoryLimitMb,
    cpuLimit: config.cpuLimit,
    pidsLimit: config.pidsLimit,
  };
};

const createExecutionLogger = (
  trace: ExecutionTrace,
  language: SupportedLanguage,
  filePath: string,
) =>
  createStructuredLogger({
    scope: "RUNTIME_ENGINE",
    trace,
    defaultContext: {
      executionId: trace.executionId,
      traceId: trace.traceId,
      language,
      filePath,
    },
  });

const logPhaseResult = (
  logger: StructuredLogger,
  result: ExecutionPhaseResult,
  language: SupportedLanguage,
  filePath: string,
) => {
  const level =
    result.status === "completed"
      ? "runtime"
      : result.status === "skipped"
        ? "info"
        : "warn";

  const payload = {
    phase: result.phase,
    language,
    command: result.command,
    filePath,
    durationMs: result.durationMs,
    exitCode: result.exitCode,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    details: {
      status: result.status,
      timedOut: result.timedOut,
      outputLimitExceeded: result.outputLimitExceeded,
      failureCategory: result.failureCategory ?? "",
      summary: result.summary,
      oomKilled: result.oomKilled ?? false,
    },
  };

  if (level === "warn") {
    logger.warn(`${result.phase} phase ${result.status}.`, payload);
    return;
  }

  if (level === "info") {
    logger.info(`${result.phase} phase skipped.`, payload);
    return;
  }

  logger.runtime(`${result.phase} phase completed.`, payload);
};

const isMissingRuntimeError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "ENOENT";

const ensureWorkspace = async (
  prefix: string,
  fileName: string,
  code: string,
) => {
  const workspaceDir = path.join(os.tmpdir(), prefix, randomUUID());
  const filePath = path.join(workspaceDir, fileName);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, code, "utf8");

  return {
    workspaceDir,
    filePath,
  };
};

const runWithCandidates = async ({
  candidates,
  args,
  cwd,
  stdin,
  timeoutMs,
  missingMessage,
  logger,
  phase,
  language,
  filePath,
  env,
  shouldTreatResultAsMissing,
}: RunWithCandidatesOptions): Promise<RunWithCandidatesSuccess> => {
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const result = await runCommandWithLimits({
        command: candidate.command,
        args: [...(candidate.args ?? []), ...args],
        cwd,
        stdin,
        env,
        timeoutMs,
        outputLimitBytes: executionInfrastructureConfig.outputBufferBytes,
        logger,
        phase,
        language,
        filePath,
      });

      if (shouldTreatResultAsMissing?.(candidate, result)) {
        const unavailableRuntimeError = new Error(missingMessage) as NodeJS.ErrnoException;
        unavailableRuntimeError.code = "ENOENT";
        lastError = unavailableRuntimeError;
        continue;
      }

      return {
        command: [candidate.command, ...(candidate.args ?? []), ...args].join(" "),
        result,
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        ((error as { code?: string }).code === "ENOENT" ||
          ((error as { code?: string }).code === "EACCES" &&
            process.platform === "win32"))
      ) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  if (
    lastError instanceof Error &&
    !(
      "code" in lastError &&
      typeof (lastError as NodeJS.ErrnoException).code === "string" &&
      ["ENOENT", "EACCES"].includes(
        (lastError as NodeJS.ErrnoException).code as string,
      )
    )
  ) {
    throw lastError;
  }

  const missingRuntimeError = new Error(missingMessage) as NodeJS.ErrnoException;
  missingRuntimeError.code = "ENOENT";
  throw missingRuntimeError;
};

const appendTraceSkip = (
  trace: ExecutionTrace,
  language: SupportedLanguage,
  reason: string,
) => {
  const command =
    language === "python"
      ? languageExecutionConfigs.python.traceCommand ?? "python trace"
      : language === "javascript"
        ? "codesight javascript trace"
        : "codesight compiled-language walkthrough";
  setPhase(trace, "trace", createSkippedPhaseResult("trace", command, reason));
};

const applyRunPhase = (
  trace: ExecutionTrace,
  language: SupportedLanguage,
  filePath: string,
  logger: StructuredLogger,
  command: string,
  result: RunCommandWithLimitsResult,
  phase: "compile" | "run",
) => {
  const phaseResult = createPhaseResult(phase, command, result);
  setPhase(trace, phase, phaseResult);
  logPhaseResult(logger, phaseResult, language, filePath);

  if (phase === "run") {
    trace.output = phaseResult.stdout;
    trace.outputLines = splitOutputLines(phaseResult.stdout);
  }

  return phaseResult;
};

const createTracePhase = (
  command: string,
  startedAt: number,
  timeline: ExecutionTimeline,
): ExecutionPhaseResult => ({
  phase: "trace",
  status: timeline.error ? "failed" : "completed",
  command,
  stdout: timeline.output.join("\n"),
  stderr: timeline.error ?? "",
  exitCode: timeline.error ? 1 : 0,
  signal: null,
  durationMs: Math.round(performance.now() - startedAt),
  timedOut: false,
  outputLimitExceeded: false,
  failureCategory: timeline.error ? "trace" : null,
  summary: timeline.error
    ? "Trace generation failed."
    : timeline.truncated
      ? "Trace captured safely with a step cap."
      : "Trace generated successfully.",
});

const completeTrace = (
  trace: ExecutionTrace,
  language: SupportedLanguage,
  code: string,
  logger: StructuredLogger,
) => {
  materializeTraceFrames({
    trace,
    code,
    language,
    logger,
  });

  return finalizeTrace(trace, language);
};

const maybeRunJavaScriptTrace = async (
  trace: ExecutionTrace,
  code: string,
  filePath: string,
  logger: StructuredLogger,
) => {
  if (trace.mode.traceStrategy !== "full") {
    appendTraceSkip(trace, "javascript", trace.mode.reason);
    logger.info("Skipped JavaScript trace generation.", {
      phase: "trace",
      details: {
        mode: trace.mode.selected,
        traceStrategy: trace.mode.traceStrategy,
      },
    });
    return;
  }

  const traceStartedAt = performance.now();

  try {
    const timeline = executeJavaScript(code, logger);
    trace.steps = timeline.steps;
    const tracePhase = createTracePhase(
      "codesight javascript trace",
      traceStartedAt,
      timeline,
    );
    setPhase(trace, "trace", tracePhase);
    logPhaseResult(logger, tracePhase, "javascript", filePath);
  } catch (error) {
    const tracePhase = createSyntheticPhaseFailure(
      "trace",
      "codesight javascript trace",
      error instanceof Error ? error.message : "JavaScript trace generation failed.",
      "trace",
      Math.round(performance.now() - traceStartedAt),
    );
    setPhase(trace, "trace", tracePhase);
    logger.error("JavaScript trace parser failed.", error, {
      phase: "trace",
      command: "codesight javascript trace",
      durationMs: tracePhase.durationMs,
    });
  }
};

const maybeRunPythonTrace = async (
  trace: ExecutionTrace,
  code: string,
  stdin: string,
  filePath: string,
  logger: StructuredLogger,
  traceTimeoutMs: number,
  maxTraceSteps: number,
) => {
  if (trace.mode.traceStrategy === "skipped") {
    appendTraceSkip(trace, "python", trace.mode.reason);
    logger.info("Skipped Python trace generation.", {
      phase: "trace",
      details: {
        mode: trace.mode.selected,
        traceStrategy: trace.mode.traceStrategy,
      },
    });
    return;
  }

  const traceStartedAt = performance.now();

  try {
    const timeline = await executePython(
      code,
      stdin,
      traceTimeoutMs,
      maxTraceSteps,
      logger,
    );
    trace.steps = timeline.steps;
    const tracePhase = createTracePhase(
      languageExecutionConfigs.python.traceCommand ?? "python trace",
      traceStartedAt,
      timeline,
    );
    setPhase(trace, "trace", tracePhase);
    logPhaseResult(logger, tracePhase, "python", filePath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Python trace generation failed.";
    const tracePhase = createSyntheticPhaseFailure(
      "trace",
      languageExecutionConfigs.python.traceCommand ?? "python trace",
      message,
      /timed out/i.test(message) ? "timeout" : "trace",
      Math.round(performance.now() - traceStartedAt),
    );
    setPhase(trace, "trace", tracePhase);
    logger.error("Python trace runner failed.", error, {
      phase: "trace",
      command: languageExecutionConfigs.python.traceCommand ?? "python trace",
      durationMs: tracePhase.durationMs,
    });
  }
};

const maybeRunCompiledTrace = (
  trace: ExecutionTrace,
  language: Extract<SupportedLanguage, "c" | "cpp" | "java">,
  code: string,
  filePath: string,
  logger: StructuredLogger,
) => {
  if (trace.mode.traceStrategy !== "full") {
    appendTraceSkip(trace, language, trace.mode.reason);
    logger.info("Skipped compiled-language walkthrough generation.", {
      phase: "trace",
      details: {
        mode: trace.mode.selected,
        traceStrategy: trace.mode.traceStrategy,
      },
    });
    return;
  }

  const traceStartedAt = performance.now();

  try {
    trace.steps = createCompiledLanguageWalkthrough(
      code,
      language,
      trace.outputLines,
      logger,
    );
    const tracePhase: ExecutionPhaseResult = {
      phase: "trace",
      status: "completed",
      command: "codesight compiled-language walkthrough",
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: Math.round(performance.now() - traceStartedAt),
      timedOut: false,
      outputLimitExceeded: false,
      failureCategory: null,
      summary: "Trace generated successfully.",
    };
    setPhase(trace, "trace", tracePhase);
    logPhaseResult(logger, tracePhase, language, filePath);
  } catch (error) {
    const tracePhase = createSyntheticPhaseFailure(
      "trace",
      "codesight compiled-language walkthrough",
      error instanceof Error ? error.message : "Trace generation failed.",
      "trace",
      Math.round(performance.now() - traceStartedAt),
    );
    setPhase(trace, "trace", tracePhase);
    logger.error("Compiled trace walkthrough generation failed.", error, {
      phase: "trace",
      command: "codesight compiled-language walkthrough",
      durationMs: tracePhase.durationMs,
    });
  }
};

const detectJavaLayout = (workspaceDir: string, code: string): JavaLayout => {
  const packageName =
    code.match(/^\s*package\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*;/m)?.[1] ?? "";
  const publicClassWithMain =
    code.match(
      /\bpublic\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)[\s\S]*?public\s+static\s+void\s+main\s*\(/m,
    )?.[1] ?? null;
  const classWithMain =
    code.match(
      /\bclass\s+([A-Za-z_]\w*)[\s\S]*?public\s+static\s+void\s+main\s*\(/m,
    )?.[1] ?? null;
  const publicClass =
    code.match(/\bpublic\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)\b/m)?.[1] ??
    null;
  const fallbackClass =
    code.match(/\bclass\s+([A-Za-z_]\w*)\b/m)?.[1] ??
    "Main";

  const sourceClassName =
    publicClass ?? publicClassWithMain ?? classWithMain ?? fallbackClass;
  const runClassName = classWithMain ?? publicClassWithMain ?? sourceClassName;
  const packageDirectory = packageName
    ? path.join(workspaceDir, ...packageName.split("."))
    : workspaceDir;
  const sourceFile = path.join(packageDirectory, `${sourceClassName}.java`);
  const compileTarget = sourceFile;

  return {
    sourceFile,
    compileTarget,
    runClassName: packageName ? `${packageName}.${runClassName}` : runClassName,
  };
};

const executeJavaScriptLocally = async (
  code: string,
  stdin = "",
  queueTimeMs = 0,
): Promise<ExecutionTrace> => {
  const plan = createExecutionModePlan("javascript", code, stdin);
  const trace = createTraceSkeleton(
    "javascript",
    buildLimits("javascript", plan.traceTimeoutMs),
    summarizeStdin(stdin),
    queueTimeMs,
  );
  trace.mode = plan.selection;

  const { workspaceDir, filePath } = await ensureWorkspace(
    "codesight-js",
    "main.js",
    code,
  );
  const logger = createExecutionLogger(trace, "javascript", filePath);

  logger.info("Prepared JavaScript workspace.", {
    phase: "run",
    details: {
      workspaceDir,
      sourceBytes: Buffer.byteLength(code, "utf8"),
      mode: trace.mode.selected,
      traceStrategy: trace.mode.traceStrategy,
    },
  });

  try {
    const { command, result } = await runWithCandidates({
      candidates: getNodeCandidates(),
      args: [
        `--max-old-space-size=${Math.max(256, trace.limits.memoryLimitMb)}`,
        "--stack_size=65500",
        filePath,
      ],
      cwd: workspaceDir,
      stdin,
      timeoutMs: trace.limits.runTimeoutMs,
      missingMessage:
        "Node.js runtime was not found. Install Node.js and make sure `node --version` works in your terminal.",
      logger,
      phase: "run",
      language: "javascript",
      filePath,
      env: {
        NODE_DISABLE_COLORS: "1",
        FORCE_COLOR: "0",
      },
    });
    const runPhase = applyRunPhase(trace, "javascript", filePath, logger, command, result, "run");

    if (runPhase.status !== "completed") {
      appendTraceSkip(trace, "javascript", "Trace skipped because execution did not complete.");
      logger.info("Skipped JavaScript trace generation because execution did not complete.", {
        phase: "trace",
      });
      return completeTrace(trace, "javascript", code, logger);
    }

    await maybeRunJavaScriptTrace(trace, code, filePath, logger);
    return completeTrace(trace, "javascript", code, logger);
  } catch (error) {
    const runPhase = createSyntheticPhaseFailure(
      "run",
      languageExecutionConfigs.javascript.runCommand,
      error instanceof Error ? error.message : "JavaScript execution failed.",
      isMissingRuntimeError(error) ? "runtime_missing" : "internal",
    );
    setPhase(trace, "run", runPhase);
    logger.error("JavaScript execution failed before the run phase completed.", error, {
      phase: "run",
      command: languageExecutionConfigs.javascript.runCommand,
    });
    appendTraceSkip(trace, "javascript", "Trace skipped because execution could not start.");
    return completeTrace(trace, "javascript", code, logger);
  } finally {
    await removeDirectory(workspaceDir);
  }
};

const executePythonLocally = async (
  code: string,
  stdin = "",
  queueTimeMs = 0,
): Promise<ExecutionTrace> => {
  const plan = createExecutionModePlan("python", code, stdin);
  const trace = createTraceSkeleton(
    "python",
    buildLimits("python", plan.traceTimeoutMs),
    summarizeStdin(stdin),
    queueTimeMs,
  );
  trace.mode = plan.selection;

  const { workspaceDir, filePath } = await ensureWorkspace(
    "codesight-python",
    "main.py",
    code,
  );
  const logger = createExecutionLogger(trace, "python", filePath);

  logger.info("Prepared Python workspace.", {
    phase: "run",
    details: {
      workspaceDir,
      sourceBytes: Buffer.byteLength(code, "utf8"),
      mode: trace.mode.selected,
      traceStrategy: trace.mode.traceStrategy,
      maxTraceSteps: plan.maxTraceSteps,
    },
  });

  try {
    const { command, result } = await runWithCandidates({
      candidates: getPythonCandidates(),
      args: [filePath],
      cwd: workspaceDir,
      stdin,
      timeoutMs: trace.limits.runTimeoutMs,
      missingMessage:
        "Python runtime was not found. Install Python 3 and make sure `python --version` or `python3 --version` works in your terminal.",
      logger,
      phase: "run",
      language: "python",
      filePath,
      env: {
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      shouldTreatResultAsMissing: (candidate, candidateResult) =>
        /^python(?:3(?:\.exe)?)?(?:\.exe)?$/i.test(candidate.command) &&
        pythonWindowsStoreAliasPattern.test(candidateResult.stderr),
    });
    const runPhase = applyRunPhase(trace, "python", filePath, logger, command, result, "run");

    if (runPhase.status !== "completed") {
      appendTraceSkip(trace, "python", "Trace skipped because execution did not complete.");
      logger.info("Skipped Python trace generation because execution did not complete.", {
        phase: "trace",
      });
      return completeTrace(trace, "python", code, logger);
    }

    await maybeRunPythonTrace(
      trace,
      code,
      stdin,
      filePath,
      logger,
      plan.traceTimeoutMs,
      plan.maxTraceSteps,
    );

    return completeTrace(trace, "python", code, logger);
  } catch (error) {
    const runPhase = createSyntheticPhaseFailure(
      "run",
      languageExecutionConfigs.python.runCommand,
      error instanceof Error ? error.message : "Python execution failed.",
      isMissingRuntimeError(error) ? "runtime_missing" : "internal",
    );
    setPhase(trace, "run", runPhase);
    logger.error("Python execution failed before the run phase completed.", error, {
      phase: "run",
      command: languageExecutionConfigs.python.runCommand,
    });
    appendTraceSkip(trace, "python", "Trace skipped because execution could not start.");
    return completeTrace(trace, "python", code, logger);
  } finally {
    await removeDirectory(workspaceDir);
  }
};

const compileAndRunLocally = async (
  language: "c" | "cpp",
  code: string,
  stdin = "",
  queueTimeMs = 0,
): Promise<ExecutionTrace> => {
  const plan = createExecutionModePlan(language, code, stdin);
  const trace = createTraceSkeleton(
    language,
    buildLimits(language, plan.traceTimeoutMs),
    summarizeStdin(stdin),
    queueTimeMs,
  );
  trace.mode = plan.selection;

  const sourceFileName =
    language === "c"
      ? languageExecutionConfigs.c.fileName
      : languageExecutionConfigs.cpp.fileName;
  const { workspaceDir, filePath: sourceFile } = await ensureWorkspace(
    `codesight-${language}`,
    sourceFileName,
    code,
  );
  const outputFile = path.join(
    workspaceDir,
    process.platform === "win32" ? "program.exe" : "program",
  );
  const logger = createExecutionLogger(trace, language, sourceFile);

  logger.info(`Prepared ${language.toUpperCase()} workspace.`, {
    phase: "compile",
    details: {
      workspaceDir,
      sourceBytes: Buffer.byteLength(code, "utf8"),
      outputFile,
      mode: trace.mode.selected,
      traceStrategy: trace.mode.traceStrategy,
    },
  });

  try {
    const compileArgs =
      language === "c"
        ? [sourceFile, "-O2", "-pipe", "-std=c11", "-o", outputFile]
        : [sourceFile, "-O2", "-pipe", "-std=c++17", "-o", outputFile];
    const compileCandidate = await runWithCandidates({
      candidates: language === "c" ? getGccCandidates() : getGppCandidates(),
      args: compileArgs,
      cwd: workspaceDir,
      stdin: "",
      timeoutMs: trace.limits.compileTimeoutMs,
      missingMessage:
        language === "c"
          ? "GCC compiler was not found. Install GCC and make sure `gcc --version` works in your terminal."
          : "G++ compiler was not found. Install G++ and make sure `g++ --version` works in your terminal.",
      logger,
      phase: "compile",
      language,
      filePath: sourceFile,
    });
    const compilePhase = applyRunPhase(
      trace,
      language,
      sourceFile,
      logger,
      compileCandidate.command,
      compileCandidate.result,
      "compile",
    );

    if (compilePhase.status !== "completed") {
      appendTraceSkip(trace, language, "Trace skipped because compilation did not complete.");
      logger.info("Skipped compiled-language trace generation because compilation did not complete.", {
        phase: "trace",
      });
      return completeTrace(trace, language, code, logger);
    }

    const runResult = await runCommandWithLimits({
      command: outputFile,
      args: [],
      cwd: workspaceDir,
      stdin,
      timeoutMs: trace.limits.runTimeoutMs,
      outputLimitBytes: executionInfrastructureConfig.outputBufferBytes,
      logger,
      phase: "run",
      language,
      filePath: outputFile,
    });
    const runPhase = applyRunPhase(trace, language, sourceFile, logger, outputFile, runResult, "run");

    if (runPhase.status !== "completed") {
      appendTraceSkip(trace, language, "Trace skipped because execution did not complete.");
      logger.info("Skipped compiled-language trace generation because execution did not complete.", {
        phase: "trace",
      });
      return completeTrace(trace, language, code, logger);
    }

    maybeRunCompiledTrace(trace, language, code, sourceFile, logger);
    return completeTrace(trace, language, code, logger);
  } catch (error) {
    const phase = trace.phases.compile ? "run" : "compile";
    const command =
      phase === "compile"
        ? languageExecutionConfigs[language].compileCommand ?? ""
        : outputFile;
    const failedPhase = createSyntheticPhaseFailure(
      phase,
      command,
      error instanceof Error ? error.message : "Execution failed.",
      isMissingRuntimeError(error) ? "runtime_missing" : "internal",
    );
    setPhase(trace, phase, failedPhase);
    logger.error("Compiled-language execution failed before the phase completed.", error, {
      phase,
      command,
    });
    appendTraceSkip(trace, language, "Trace skipped because execution could not start.");
    return completeTrace(trace, language, code, logger);
  } finally {
    await removeDirectory(workspaceDir);
  }
};

const executeJavaLocally = async (
  code: string,
  stdin = "",
  queueTimeMs = 0,
): Promise<ExecutionTrace> => {
  const plan = createExecutionModePlan("java", code, stdin);
  const trace = createTraceSkeleton(
    "java",
    buildLimits("java", plan.traceTimeoutMs),
    summarizeStdin(stdin),
    queueTimeMs,
  );
  trace.mode = plan.selection;

  const workspaceDir = path.join(os.tmpdir(), "codesight-java", randomUUID());
  const javaLayout = detectJavaLayout(workspaceDir, code);
  await fs.mkdir(path.dirname(javaLayout.sourceFile), { recursive: true });
  await fs.writeFile(javaLayout.sourceFile, code, "utf8");

  const logger = createExecutionLogger(trace, "java", javaLayout.sourceFile);

  logger.info("Prepared Java workspace.", {
    phase: "compile",
    details: {
      workspaceDir,
      sourceBytes: Buffer.byteLength(code, "utf8"),
      sourceFile: javaLayout.sourceFile,
      runClassName: javaLayout.runClassName,
      mode: trace.mode.selected,
      traceStrategy: trace.mode.traceStrategy,
    },
  });

  try {
    const compileCandidate = await runWithCandidates({
      candidates: getJavacCandidates(),
      args: ["-encoding", "UTF-8", javaLayout.compileTarget],
      cwd: workspaceDir,
      stdin: "",
      timeoutMs: trace.limits.compileTimeoutMs,
      missingMessage:
        "Java compiler was not found. Install a JDK and make sure `javac -version` works in your terminal.",
      logger,
      phase: "compile",
      language: "java",
      filePath: javaLayout.sourceFile,
    });
    const compilePhase = applyRunPhase(
      trace,
      "java",
      javaLayout.sourceFile,
      logger,
      compileCandidate.command,
      compileCandidate.result,
      "compile",
    );

    if (compilePhase.status !== "completed") {
      appendTraceSkip(trace, "java", "Trace skipped because compilation did not complete.");
      logger.info("Skipped Java trace generation because compilation did not complete.", {
        phase: "trace",
      });
      return completeTrace(trace, "java", code, logger);
    }

    const runCandidate = await runWithCandidates({
      candidates: getJavaCandidates(),
      args: [
        `-Xms64m`,
        `-Xmx${Math.max(256, trace.limits.memoryLimitMb)}m`,
        "-Xss16m",
        "-Dfile.encoding=UTF-8",
        "-cp",
        workspaceDir,
        javaLayout.runClassName,
      ],
      cwd: workspaceDir,
      stdin,
      timeoutMs: trace.limits.runTimeoutMs,
      missingMessage:
        "Java runtime was not found. Install a JDK and make sure `java -version` works in your terminal.",
      logger,
      phase: "run",
      language: "java",
      filePath: javaLayout.sourceFile,
    });
    const runPhase = applyRunPhase(
      trace,
      "java",
      javaLayout.sourceFile,
      logger,
      runCandidate.command,
      runCandidate.result,
      "run",
    );

    if (runPhase.status !== "completed") {
      appendTraceSkip(trace, "java", "Trace skipped because execution did not complete.");
      logger.info("Skipped Java trace generation because execution did not complete.", {
        phase: "trace",
      });
      return completeTrace(trace, "java", code, logger);
    }

    maybeRunCompiledTrace(trace, "java", code, javaLayout.sourceFile, logger);
    return completeTrace(trace, "java", code, logger);
  } catch (error) {
    const phase = trace.phases.compile ? "run" : "compile";
    const command =
      phase === "compile"
        ? languageExecutionConfigs.java.compileCommand ?? ""
        : languageExecutionConfigs.java.runCommand;
    const failedPhase = createSyntheticPhaseFailure(
      phase,
      command,
      error instanceof Error ? error.message : "Java execution failed.",
      isMissingRuntimeError(error) ? "runtime_missing" : "internal",
    );
    setPhase(trace, phase, failedPhase);
    logger.error("Java execution failed before the phase completed.", error, {
      phase,
      command,
    });
    appendTraceSkip(trace, "java", "Trace skipped because execution could not start.");
    return completeTrace(trace, "java", code, logger);
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
