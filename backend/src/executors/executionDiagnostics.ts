import type {
  ExecutionDiagnostic,
  ExecutionFailureCategory,
  ExecutionPhaseName,
  ExecutionPhaseResult,
  ExecutionStatus,
  SupportedLanguage,
} from "../types/execution";

const combineStreams = (stdout: string, stderr: string) =>
  [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");

const createDiagnostic = (
  partial: Omit<ExecutionDiagnostic, "severity"> & {
    severity?: ExecutionDiagnostic["severity"];
  },
): ExecutionDiagnostic => ({
  severity: partial.severity ?? "error",
  ...partial,
});

const parseGccDiagnostics = (
  raw: string,
  phase: ExecutionPhaseName,
): ExecutionDiagnostic[] => {
  const diagnostics: ExecutionDiagnostic[] = [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const match = line.match(
      /^(.*?):(\d+):(\d+):\s+(fatal error|error|warning|note):\s+(.*)$/,
    );

    if (!match) {
      continue;
    }

    const [, file, lineNumber, columnNumber, severityLabel, message] = match;
    diagnostics.push(
      createDiagnostic({
        category: phase === "compile" ? "compile" : "runtime",
        phase,
        source: phase === "compile" ? "gcc" : "program",
        severity:
          severityLabel === "warning"
            ? "warning"
            : severityLabel === "note"
              ? "info"
              : "error",
        summary: message.trim(),
        detail: line.trim(),
        file,
        line: Number(lineNumber),
        column: Number(columnNumber),
        endLine: Number(lineNumber),
        endColumn: Number(columnNumber) + 1,
        raw: line.trim(),
      }),
    );
  }

  return diagnostics;
};

const parseJavacDiagnostics = (raw: string): ExecutionDiagnostic[] => {
  const diagnostics: ExecutionDiagnostic[] = [];
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const headerMatch = lines[index]?.match(/^(.*?\.java):(\d+):\s+error:\s+(.*)$/);

    if (!headerMatch) {
      continue;
    }

    const [, file, lineNumber, message] = headerMatch;
    const caretLine = lines[index + 2] ?? "";
    const caretColumn = caretLine.indexOf("^");
    diagnostics.push(
      createDiagnostic({
        category: "compile",
        phase: "compile",
        source: "javac",
        summary: message.trim(),
        detail: [lines[index], lines[index + 1], lines[index + 2]]
          .filter(Boolean)
          .join("\n"),
        file,
        line: Number(lineNumber),
        column: caretColumn >= 0 ? caretColumn + 1 : 1,
        endLine: Number(lineNumber),
        endColumn: caretColumn >= 0 ? caretColumn + 2 : 2,
        raw: [lines[index], lines[index + 1], lines[index + 2]]
          .filter(Boolean)
          .join("\n"),
      }),
    );
  }

  return diagnostics;
};

const parsePythonDiagnostics = (
  raw: string,
  phase: ExecutionPhaseName,
): ExecutionDiagnostic[] => {
  const normalized = raw.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const lastLine = lines[lines.length - 1] ?? normalized;
  const fileMatch = [...normalized.matchAll(/File "([^"]+)", line (\d+)/g)].pop();
  const caretLine = lines.find((line) => /^\s*\^/.test(line));
  const column = caretLine ? caretLine.indexOf("^") + 1 : undefined;
  const [summaryPrefix, ...summaryRest] = lastLine.split(":");
  const summary =
    summaryRest.length > 0 ? `${summaryPrefix}: ${summaryRest.join(":").trim()}` : lastLine;

  return [
    createDiagnostic({
      category: phase === "trace" ? "trace" : "runtime",
      phase,
      source: "python",
      summary: summary.trim(),
      detail: normalized,
      file: fileMatch?.[1],
      line: fileMatch ? Number(fileMatch[2]) : undefined,
      column,
      endLine: fileMatch ? Number(fileMatch[2]) : undefined,
      endColumn: column ? column + 1 : undefined,
      raw: normalized,
      stackTrace:
        lines.length > 1 ? lines.filter((line) => line.trim().startsWith("File ")) : [],
    }),
  ];
};

const parseNodeDiagnostics = (
  raw: string,
  phase: ExecutionPhaseName,
): ExecutionDiagnostic[] => {
  const normalized = raw.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const messageLine =
    lines.find((line) => /\b(?:ReferenceError|TypeError|SyntaxError|RangeError|Error):/.test(line)) ??
    lines[0];
  const stackLine =
    lines.find((line) => /\((.*?):(\d+):(\d+)\)/.test(line)) ??
    lines.find((line) => /at .*?:(\d+):(\d+)/.test(line));
  const directLocation = lines.find((line) => /^(.*?):(\d+)$/.test(line));
  const caretLine = lines.find((line) => /^\s*\^/.test(line));
  const stackMatch =
    stackLine?.match(/\((.*?):(\d+):(\d+)\)/) ??
    stackLine?.match(/at (.*?):(\d+):(\d+)/);
  const directMatch = directLocation?.match(/^(.*?):(\d+)$/);

  return [
    createDiagnostic({
      category: phase === "trace" ? "trace" : "runtime",
      phase,
      source: "node",
      summary: messageLine.trim(),
      detail: normalized,
      file: stackMatch?.[1] ?? directMatch?.[1],
      line: stackMatch?.[2] ? Number(stackMatch[2]) : directMatch?.[2] ? Number(directMatch[2]) : undefined,
      column: stackMatch?.[3]
        ? Number(stackMatch[3])
        : caretLine
          ? caretLine.indexOf("^") + 1
          : undefined,
      endLine: stackMatch?.[2] ? Number(stackMatch[2]) : directMatch?.[2] ? Number(directMatch[2]) : undefined,
      endColumn: stackMatch?.[3]
        ? Number(stackMatch[3]) + 1
        : caretLine
          ? caretLine.indexOf("^") + 2
          : undefined,
      raw: normalized,
      stackTrace: lines.filter((line) => line.trim().startsWith("at ")),
    }),
  ];
};

const parseJavaRuntimeDiagnostics = (raw: string): ExecutionDiagnostic[] => {
  const normalized = raw.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const summary = lines[0] ?? "Java runtime error";
  const stackLine = lines.find((line) => /\((.*?\.java):(\d+)\)/.test(line));
  const stackMatch = stackLine?.match(/\((.*?\.java):(\d+)\)/);

  return [
    createDiagnostic({
      category: "runtime",
      phase: "run",
      source: "java",
      summary: summary.trim(),
      detail: normalized,
      file: stackMatch?.[1],
      line: stackMatch?.[2] ? Number(stackMatch[2]) : undefined,
      endLine: stackMatch?.[2] ? Number(stackMatch[2]) : undefined,
      raw: normalized,
      stackTrace: lines.filter((line) => line.trim().startsWith("at ")),
    }),
  ];
};

const parseTraceDiagnostics = (
  language: SupportedLanguage,
  raw: string,
): ExecutionDiagnostic[] => {
  switch (language) {
    case "python":
      return parsePythonDiagnostics(raw, "trace");
    case "javascript":
      return parseNodeDiagnostics(raw, "trace");
    default:
      return [
        createDiagnostic({
          category: "trace",
          phase: "trace",
          source: "codesight-trace",
          summary: "Trace generation failed.",
          detail: raw.trim() || "The trace engine failed without stderr output.",
          raw: raw.trim(),
        }),
      ];
  }
};

const parsePhaseDiagnostics = (
  language: SupportedLanguage,
  phase: ExecutionPhaseResult,
): ExecutionDiagnostic[] => {
  const raw = combineStreams(phase.stdout, phase.stderr);

  if (!raw) {
    return [];
  }

  if (phase.status === "completed") {
    if (phase.phase === "compile" && (language === "c" || language === "cpp")) {
      return parseGccDiagnostics(raw, "compile").filter(
        (diagnostic) => diagnostic.severity !== "error",
      );
    }

    return [];
  }

  if (phase.failureCategory === "timeout") {
    return [
      createDiagnostic({
        category: "timeout",
        phase: phase.phase,
        source: phase.phase === "compile" ? "compiler" : "runtime",
        summary:
          phase.phase === "compile"
            ? "Compilation timed out."
            : phase.phase === "trace"
              ? "Trace generation timed out."
              : "Program execution timed out.",
        detail: raw,
        raw,
      }),
    ];
  }

  if (phase.failureCategory === "memory") {
    return [
      createDiagnostic({
        category: "memory",
        phase: phase.phase,
        source: phase.phase === "compile" ? "compiler" : "runtime",
        summary:
          phase.phase === "compile"
            ? "Compilation exceeded the memory limit."
            : "Program exceeded the memory limit.",
        detail: raw,
        raw,
      }),
    ];
  }

  if (phase.failureCategory === "runtime_missing") {
    return [
      createDiagnostic({
        category: "runtime_missing",
        phase: phase.phase,
        source: "codesight-runtime",
        summary: phase.summary || "Required local runtime is missing.",
        detail: raw,
        raw,
      }),
    ];
  }

  if (phase.failureCategory === "internal") {
    return [
      createDiagnostic({
        category: "internal",
        phase: phase.phase,
        source: "codesight-runtime",
        summary: phase.summary || "CodeSight could not execute this phase.",
        detail: raw,
        raw,
      }),
    ];
  }

  if (phase.phase === "compile") {
    if (language === "java") {
      return parseJavacDiagnostics(raw);
    }

    if (language === "c" || language === "cpp") {
      return parseGccDiagnostics(raw, "compile");
    }
  }

  if (phase.phase === "run") {
    if (language === "python") {
      return parsePythonDiagnostics(raw, "run");
    }

    if (language === "javascript") {
      return parseNodeDiagnostics(raw, "run");
    }

    if (language === "java") {
      return parseJavaRuntimeDiagnostics(raw);
    }

    if (language === "c" || language === "cpp") {
      const diagnostics = parseGccDiagnostics(raw, "run");

      if (diagnostics.length > 0) {
        return diagnostics;
      }
    }
  }

  if (phase.phase === "trace") {
    return parseTraceDiagnostics(language, raw);
  }

  const fallbackCategory =
    phase.failureCategory ?? (phase.phase === "compile" ? "compile" : "runtime");

  return [
    createDiagnostic({
      category: fallbackCategory,
      phase: phase.phase,
      source:
        phase.phase === "compile"
          ? "compiler"
          : "runtime",
      summary: phase.summary || raw.split("\n")[0] || "Execution failed.",
      detail: raw,
      raw,
      stackTrace: raw
        .split("\n")
        .filter((line) => line.trim().startsWith("at ") || line.includes("File ")),
    }),
  ];
};

const buildTimeoutSuggestion = (language: SupportedLanguage, stdinProvided: boolean) => {
  if (!stdinProvided) {
    return "If this program expects standard input, add it in the Program Input panel before running again.";
  }

  if (language === "java" || language === "c" || language === "cpp") {
    return "Check for blocked input reads, deadlocks, unbounded recursion, or very large loops.";
  }

  return "Check for blocked input reads, infinite loops, or very large recursion depth.";
};

const classifyPhaseStatus = (
  phase: ExecutionPhaseResult,
): {
  status: ExecutionStatus;
  failurePhase: ExecutionPhaseName;
} => {
  switch (phase.failureCategory) {
    case "compile":
      return { status: "compile_error", failurePhase: phase.phase };
    case "runtime_missing":
      return { status: "runtime_missing", failurePhase: phase.phase };
    case "runtime":
      return { status: "runtime_error", failurePhase: phase.phase };
    case "timeout":
      return { status: "timed_out", failurePhase: phase.phase };
    case "memory":
      return { status: "memory_limit", failurePhase: phase.phase };
    case "trace":
      return { status: "trace_failure", failurePhase: phase.phase };
    default:
      return { status: "internal_error", failurePhase: phase.phase };
  }
};

export const collectExecutionDiagnostics = (
  language: SupportedLanguage,
  phases: Array<ExecutionPhaseResult | null>,
): ExecutionDiagnostic[] =>
  phases.flatMap((phase) => (phase ? parsePhaseDiagnostics(language, phase) : []));

export const classifyExecutionOutcome = ({
  language,
  compilePhase,
  runPhase,
  tracePhase,
  systemLogs,
  diagnostics,
  stdinProvided,
}: {
  language: SupportedLanguage;
  compilePhase: ExecutionPhaseResult | null;
  runPhase: ExecutionPhaseResult | null;
  tracePhase: ExecutionPhaseResult | null;
  systemLogs: string[];
  diagnostics: ExecutionDiagnostic[];
  stdinProvided: boolean;
}): {
  status: ExecutionStatus;
  error: string;
  failurePhase: ExecutionPhaseName | "system" | null;
  diagnostics: ExecutionDiagnostic[];
} => {
  const phases = [compilePhase, runPhase, tracePhase].filter(
    (phase): phase is ExecutionPhaseResult => Boolean(phase),
  );
  const failedCompileOrRunPhase = [compilePhase, runPhase]
    .filter((phase): phase is ExecutionPhaseResult => Boolean(phase))
    .find((phase) => phase.status !== "completed" && phase.status !== "skipped");
  const failedPhase =
    failedCompileOrRunPhase ??
    phases.find((phase) => phase.status !== "completed" && phase.status !== "skipped");

  if (systemLogs.length > 0 && !failedCompileOrRunPhase && !tracePhase) {
    const detail = systemLogs.join("\n");
    return {
      status: "internal_error",
      error: detail,
      failurePhase: "system",
      diagnostics: [
        createDiagnostic({
          category: "internal",
          phase: "system",
          source: "codesight-runtime",
          summary: "CodeSight could not complete the local execution request.",
          detail,
          raw: detail,
        }),
        ...diagnostics,
      ],
    };
  }

  if (failedCompileOrRunPhase) {
    const { status, failurePhase } = classifyPhaseStatus(failedCompileOrRunPhase);
    const detail =
      combineStreams(failedCompileOrRunPhase.stdout, failedCompileOrRunPhase.stderr) ||
      failedCompileOrRunPhase.summary ||
      "Execution failed.";
    const nextDiagnostics = diagnostics.map((diagnostic) => {
      if (diagnostic.category !== "timeout") {
        return diagnostic;
      }

      return {
        ...diagnostic,
        suggestion: buildTimeoutSuggestion(language, stdinProvided),
      };
    });

    return {
      status,
      error: detail,
      failurePhase,
      diagnostics: nextDiagnostics,
    };
  }

  if (failedPhase?.phase === "trace") {
    return {
      status: "completed",
      error: "",
      failurePhase: null,
      diagnostics,
    };
  }

  if (failedPhase) {
    const { status, failurePhase } = classifyPhaseStatus(failedPhase);
    const detail =
      combineStreams(failedPhase.stdout, failedPhase.stderr) ||
      failedPhase.summary ||
      "Execution failed.";
    const nextDiagnostics = diagnostics.map((diagnostic) => {
      if (diagnostic.category !== "timeout") {
        return diagnostic;
      }

      return {
        ...diagnostic,
        suggestion: buildTimeoutSuggestion(language, stdinProvided),
      };
    });

    return {
      status,
      error: detail,
      failurePhase,
      diagnostics: nextDiagnostics,
    };
  }

  return {
    status: "completed",
    error: "",
    failurePhase: null,
    diagnostics,
  };
};
