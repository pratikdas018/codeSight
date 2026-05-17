import type {
  ExecutionStep,
  ExecutionTrace,
  FunctionCallSnapshot,
  HeapSnapshotNode,
  MemoryChange,
  ScopeSnapshot,
  StackFrameSnapshot,
  SupportedLanguage,
  VariableSnapshot,
} from "../../types/execution";
import type { StructuredLogger } from "../../logging/logger";

const outputPatterns: Record<SupportedLanguage, RegExp> = {
  javascript: /\bconsole\.(?:log|error|warn|info)\s*\(/,
  python: /\bprint\s*\(/,
  c: /\b(?:printf|puts|putchar|fprintf)\s*\(/,
  cpp: /\b(?:cout|cerr|clog)\b/,
  java: /\bSystem\.out\.(?:print|println)\s*\(/,
};

const executableLinePatterns: Record<SupportedLanguage, RegExp[]> = {
  javascript: [
    /^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*/,
    /^\s*[A-Za-z_$][\w$]*\s*(?:=|\+=|-=|\*=|\/=)/,
    /^\s*(?:\+\+|--)?[A-Za-z_$][\w$]*(?:\+\+|--)?\s*;?\s*$/,
    /^\s*(?:if|else if|for|while|return|console\.)/,
  ],
  python: [
    /^\s*[A-Za-z_]\w*\s*=/,
    /^\s*(?:if|elif|for|while|return|print|def)\b/,
  ],
  c: [
    /^\s*(?:[A-Za-z_]\w*[\w\s:*&<>]*\s+)?[A-Za-z_]\w*\s*(?:=|\+=|-=|\*=|\/=)/,
    /^\s*(?:if|for|while|return|printf|puts|scanf)\b/,
  ],
  cpp: [
    /^\s*(?:[A-Za-z_]\w*[\w\s:*&<>]*\s+)?[A-Za-z_]\w*\s*(?:=|\+=|-=|\*=|\/=)/,
    /^\s*(?:if|for|while|return|cout|cin)\b/,
  ],
  java: [
    /^\s*(?:[A-Za-z_]\w*[\w\s.<>\[\]]*\s+)?[A-Za-z_]\w*\s*(?:=|\+=|-=|\*=|\/=)/,
    /^\s*(?:if|for|while|return|System\.out)\b/,
  ],
};

interface TraceMaterializationOptions {
  trace: ExecutionTrace;
  code: string;
  language: SupportedLanguage;
  logger?: StructuredLogger;
}

interface OutputState {
  cursor: number;
  total: number;
}

const normalizeCode = (code: string) => code.replace(/\r\n/g, "\n");

const getCodeLines = (code: string) => normalizeCode(code).split("\n");

const getCodeLine = (codeLines: string[], lineNumber: number) =>
  codeLines[lineNumber - 1]?.trimEnd() ?? "";

const normalizeVariables = (variables: ExecutionStep["variables"]): VariableSnapshot[] => {
  if (Array.isArray(variables)) {
    return variables;
  }

  return Object.entries(variables).map(([name, value]) => ({
    name,
    scope: "global",
    value:
      typeof value === "string"
        ? value
        : typeof value === "undefined"
          ? "undefined"
          : JSON.stringify(value),
  }));
};

const groupVariablesByScope = (variables: VariableSnapshot[]) => {
  const scopes = new Map<string, VariableSnapshot[]>();

  for (const variable of variables) {
    const existing = scopes.get(variable.scope) ?? [];
    existing.push(variable);
    scopes.set(variable.scope, existing);
  }

  return [...scopes.entries()].map<ScopeSnapshot>(([name, scopedVariables]) => ({
    name,
    variables: [...scopedVariables].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  }));
};

const buildFallbackStack = (variables: VariableSnapshot[]): StackFrameSnapshot[] =>
  groupVariablesByScope(variables).map((scope) => ({
    name: scope.name,
    locals: scope.variables,
  }));

const isCompositeValue = (value: string) => {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  );
};

const buildHeap = (variables: VariableSnapshot[]): HeapSnapshotNode[] =>
  variables
    .filter((variable) => isCompositeValue(variable.value))
    .map((variable) => {
      const trimmed = variable.value.trim();
      return {
        id: `${variable.scope}:${variable.name}`,
        label: `${variable.name}${trimmed.startsWith("[") ? "[]" : "{}"}`,
        type: trimmed.startsWith("[") ? "array" : "object",
        value: trimmed,
        scope: variable.scope,
      };
    });

const buildVariableMap = (variables: VariableSnapshot[]) =>
  new Map(
    variables.map((variable) => [
      `${variable.scope}:${variable.name}`,
      variable.value,
    ]),
  );

const buildMemoryChanges = (
  previousVariables: VariableSnapshot[],
  currentVariables: VariableSnapshot[],
  previousStdout: string[],
  currentStdout: string[],
): MemoryChange[] => {
  const previousMap = buildVariableMap(previousVariables);
  const currentMap = buildVariableMap(currentVariables);
  const changes: MemoryChange[] = [];

  for (const variable of currentVariables) {
    const key = `${variable.scope}:${variable.name}`;
    const previousValue = previousMap.get(key);

    if (typeof previousValue === "undefined") {
      changes.push({
        target: variable.name,
        scope: variable.scope,
        kind: "added",
        after: variable.value,
      });
      continue;
    }

    if (previousValue !== variable.value) {
      changes.push({
        target: variable.name,
        scope: variable.scope,
        kind: "updated",
        before: previousValue,
        after: variable.value,
      });
    }
  }

  for (const [key, previousValue] of previousMap.entries()) {
    if (currentMap.has(key)) {
      continue;
    }

    const [scope, target] = key.split(":");
    changes.push({
      target,
      scope: scope ?? "global",
      kind: "removed",
      before: previousValue,
    });
  }

  if (currentStdout.length > previousStdout.length) {
    changes.push({
      target: "stdout",
      scope: "system",
      kind: "stdout",
      before: previousStdout.join("\n"),
      after: currentStdout.join("\n"),
    });
  }

  return changes;
};

const buildFunctionCalls = (
  currentStack: StackFrameSnapshot[],
  previousStack: StackFrameSnapshot[],
  lineNumber: number,
): FunctionCallSnapshot[] => {
  const previousNames = previousStack.map((frame) => frame.name);
  const currentNames = currentStack.map((frame) => frame.name);
  const calls: FunctionCallSnapshot[] = [];

  currentNames.forEach((name, index) => {
    calls.push({
      name,
      event: previousNames[index] !== name ? "enter" : "active",
      depth: index,
      lineNumber,
    });
  });

  previousNames
    .filter((name) => !currentNames.includes(name))
    .forEach((name, index) => {
      calls.push({
        name,
        event: "exit",
        depth: currentNames.length + index,
        lineNumber,
      });
    });

  return calls;
};

const looksLikeCommentOnly = (line: string, language: SupportedLanguage) => {
  const trimmed = line.trim();

  if (!trimmed) {
    return true;
  }

  if (/^[{};]+$/.test(trimmed)) {
    return true;
  }

  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return true;
  }

  if (language === "python" && trimmed === "pass") {
    return true;
  }

  return false;
};

const isExecutableFallbackLine = (line: string, language: SupportedLanguage) => {
  if (looksLikeCommentOnly(line, language)) {
    return false;
  }

  return executableLinePatterns[language].some((pattern) => pattern.test(line));
};

const normalizeExpression = (expression: string) =>
  expression.replace(/[;,\s]+$/g, "").trim();

const stripInlineComment = (line: string, language: SupportedLanguage) => {
  if (language === "python") {
    return line.replace(/\s+#.*$/g, "").trimEnd();
  }

  return line.replace(/\s+\/\/.*$/g, "").trimEnd();
};

const stringifyValue = (value: number | string) =>
  typeof value === "number" ? String(value) : value;

const tryEvaluateExpression = (
  expression: string,
  variables: Map<string, string>,
): string => {
  const trimmed = normalizeExpression(expression);

  if (!trimmed) {
    return "undefined";
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed;
  }

  if (trimmed === "true" || trimmed === "false" || trimmed === "null") {
    return trimmed;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }

  let working = trimmed;

  for (const [name, value] of variables.entries()) {
    if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
      continue;
    }

    working = working.replace(
      new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`, "g"),
      value,
    );
  }

  if (!/^[0-9+\-*/%(). <>=!&|]+$/.test(working)) {
    return trimmed;
  }

  try {
    const result = Function(`"use strict"; return (${working});`)();
    if (typeof result === "number" && Number.isFinite(result)) {
      return stringifyValue(result);
    }
    if (typeof result === "boolean") {
      return String(result);
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const applyVariableHeuristic = (
  line: string,
  language: SupportedLanguage,
  variables: Map<string, string>,
) => {
  const normalizedLine = normalizeExpression(stripInlineComment(line, language));

  if (!normalizedLine) {
    return;
  }

  const declarationMatch =
    normalizedLine.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/) ??
    normalizedLine.match(
      /^(?:(?:unsigned|signed|long|short|const|static|final)\s+)*(?:[A-Za-z_]\w*(?:::\w+)?(?:<[^>]+>)?(?:\s*[*&])?(?:\[\])?)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/,
    ) ??
    (language === "python"
      ? normalizedLine.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/)
      : null);

  if (declarationMatch) {
    variables.set(
      declarationMatch[1] ?? "value",
      tryEvaluateExpression(declarationMatch[2] ?? "", variables),
    );
    return;
  }

  const assignmentMatch = normalizedLine.match(/^([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);
  if (assignmentMatch) {
    variables.set(
      assignmentMatch[1],
      tryEvaluateExpression(assignmentMatch[2], variables),
    );
    return;
  }

  const compoundMatch = normalizedLine.match(
    /^([A-Za-z_$][\w$]*)\s*(\+=|-=|\*=|\/=)\s*(.+)$/,
  );
  if (compoundMatch) {
    const name = compoundMatch[1];
    const operator = compoundMatch[2];
    const currentValue = variables.get(name) ?? "0";
    const operand = tryEvaluateExpression(compoundMatch[3], variables);
    const leftNumber = Number(currentValue);
    const rightNumber = Number(operand);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      const nextValue =
        operator === "+="
          ? leftNumber + rightNumber
          : operator === "-="
            ? leftNumber - rightNumber
            : operator === "*="
              ? leftNumber * rightNumber
              : rightNumber === 0
                ? currentValue
                : leftNumber / rightNumber;
      variables.set(name, String(nextValue));
      return;
    }

    variables.set(name, `${currentValue} ${operator} ${operand}`);
    return;
  }

  const incrementMatch = normalizedLine.match(/^(?:\+\+|--)?([A-Za-z_$][\w$]*)(?:\+\+|--)?$/);
  if (incrementMatch) {
    const name = incrementMatch[1];
    const currentValue = Number(variables.get(name) ?? "0");
    if (Number.isFinite(currentValue)) {
      variables.set(
        name,
        String(normalizedLine.includes("--") ? currentValue - 1 : currentValue + 1),
      );
    }
  }
};

const createFallbackVariables = (variableMap: Map<string, string>): VariableSnapshot[] =>
  [...variableMap.entries()]
    .map(([name, value]) => ({
      name,
      scope: "global",
      value,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

const maybeAdvanceOutput = (
  line: string,
  language: SupportedLanguage,
  outputLines: string[],
  outputState: OutputState,
) => {
  if (!outputPatterns[language].test(line)) {
    return;
  }

  if (outputState.cursor < outputState.total) {
    outputState.cursor += 1;
  }

  if (outputState.cursor > outputLines.length) {
    outputState.cursor = outputLines.length;
  }
};

const buildFallbackFrames = (
  code: string,
  language: SupportedLanguage,
  outputLines: string[],
): ExecutionStep[] => {
  const codeLines = getCodeLines(code);
  const outputState: OutputState = {
    cursor: 0,
    total: outputLines.length,
  };
  const variableMap = new Map<string, string>();
  const steps: ExecutionStep[] = [];

  codeLines.forEach((codeLine, index) => {
    const lineNumber = index + 1;

    if (!isExecutableFallbackLine(codeLine, language)) {
      return;
    }

    applyVariableHeuristic(codeLine, language, variableMap);
    maybeAdvanceOutput(codeLine, language, outputLines, outputState);

    const variables = createFallbackVariables(variableMap);
    steps.push({
      line: lineNumber,
      lineNumber,
      codeLine: codeLine.trimEnd(),
      description: `Executing ${language} line ${lineNumber}.`,
      explanation: "CodeSight is using a simplified fallback trace for this program.",
      variables,
      stack: buildFallbackStack(variables),
      output: outputLines.slice(0, outputState.cursor),
      stdout: outputLines.slice(0, outputState.cursor),
      timestamp: steps.length,
      functionCalls: [
        {
          name: "global",
          event: "active",
          depth: 0,
          lineNumber,
        },
      ],
      activeScopes: groupVariablesByScope(variables),
      heap: buildHeap(variables),
      memoryChanges: [],
      traceSource: "fallback-static-analysis",
      traceQuality: "fallback",
    });
  });

  if (steps.length === 0) {
    const fallbackLineNumber =
      codeLines.findIndex((line) => !looksLikeCommentOnly(line, language)) + 1;
    const lineNumber = fallbackLineNumber > 0 ? fallbackLineNumber : 1;
    steps.push({
      line: lineNumber,
      lineNumber,
      codeLine: getCodeLine(codeLines, lineNumber),
      description: `Executing ${language} program.`,
      explanation: "CodeSight created a minimal playback frame because the program produced no traceable line events.",
      variables: [],
      stack: [],
      output: [...outputLines],
      stdout: [...outputLines],
      timestamp: 0,
      functionCalls: [],
      activeScopes: [],
      heap: [],
      memoryChanges: outputLines.length
        ? [
            {
              target: "stdout",
              scope: "system",
              kind: "stdout",
              after: outputLines.join("\n"),
            },
          ]
        : [],
      traceSource: "fallback-minimal",
      traceQuality: "fallback",
    });
  } else if (outputLines.length > 0) {
    const lastStep = steps[steps.length - 1];
    lastStep.output = [...outputLines];
    lastStep.stdout = [...outputLines];
  }

  return steps;
};

const inferTraceSource = (
  language: SupportedLanguage,
  trace: ExecutionTrace,
  usedFallback: boolean,
) => {
  if (usedFallback) {
    return "fallback-static-analysis";
  }

  if (language === "python") {
    return "python-sys-settrace";
  }

  if (language === "javascript") {
    return "javascript-ast-interpreter";
  }

  return "compiled-language-walkthrough";
};

const buildTraceIssue = (trace: ExecutionTrace) => {
  const tracePhase = trace.phases.trace;

  if (tracePhase?.status === "failed") {
    return tracePhase.stderr.trim() || tracePhase.summary || "Trace generation failed.";
  }

  if (tracePhase?.status === "skipped") {
    return tracePhase.summary || "Trace generation was skipped, so CodeSight created a fallback timeline.";
  }

  if (
    trace.phases.run?.status === "completed" &&
    trace.steps.length === 0
  ) {
    return "Trace generation completed without producing any frames.";
  }

  return "";
};

const enrichFrames = (
  frames: ExecutionStep[],
  codeLines: string[],
  source: string,
  quality: "full" | "fallback",
): ExecutionStep[] => {
  let previousVariables: VariableSnapshot[] = [];
  let previousStack: StackFrameSnapshot[] = [];
  let previousStdout: string[] = [];

  return frames.map((step, index) => {
    const variables = normalizeVariables(step.variables);
    const stack = step.stack && step.stack.length > 0 ? step.stack : buildFallbackStack(variables);
    const stdout = step.stdout ?? step.output ?? [];
    const lineNumber = step.lineNumber ?? step.line;
    const activeScopes =
      step.activeScopes && step.activeScopes.length > 0
        ? step.activeScopes
        : groupVariablesByScope(variables);
    const nextStep: ExecutionStep = {
      ...step,
      line: lineNumber,
      lineNumber,
      codeLine: step.codeLine ?? getCodeLine(codeLines, lineNumber),
      variables,
      stack,
      output: stdout,
      stdout,
      timestamp: step.timestamp ?? index,
      functionCalls:
        step.functionCalls && step.functionCalls.length > 0
          ? step.functionCalls
          : buildFunctionCalls(stack, previousStack, lineNumber),
      activeScopes,
      heap: step.heap && step.heap.length > 0 ? step.heap : buildHeap(variables),
      memoryChanges:
        step.memoryChanges && step.memoryChanges.length > 0
          ? step.memoryChanges
          : buildMemoryChanges(previousVariables, variables, previousStdout, stdout),
      traceSource: step.traceSource ?? source,
      traceQuality: step.traceQuality ?? quality,
    };

    previousVariables = variables;
    previousStack = stack;
    previousStdout = stdout;
    return nextStep;
  });
};

export const materializeTraceFrames = ({
  trace,
  code,
  language,
  logger,
}: TraceMaterializationOptions) => {
  const codeLines = getCodeLines(code);
  const runCompleted = trace.phases.run?.status === "completed";
  const traceIssue = buildTraceIssue(trace);
  const shouldFallback = runCompleted && trace.steps.length === 0;
  const source = inferTraceSource(language, trace, shouldFallback);
  const frames = enrichFrames(
    shouldFallback
      ? buildFallbackFrames(code, language, trace.outputLines)
      : trace.steps,
    codeLines,
    source,
    shouldFallback ? "fallback" : "full",
  );

  trace.steps = frames;
  trace.traceFrames = frames;
  trace.traceSummary = {
    available: frames.length > 0,
    frameCount: frames.length,
    quality: frames.length === 0 ? "empty" : shouldFallback ? "fallback" : "full",
    source,
    status:
      frames.length === 0
        ? traceIssue
          ? "failed"
          : "empty"
        : shouldFallback || Boolean(traceIssue)
          ? "fallback"
          : "ready",
    message:
      frames.length === 0
        ? traceIssue || "No execution frames were generated."
        : shouldFallback
          ? `Playback is ready with ${frames.length} fallback frame${frames.length === 1 ? "" : "s"}.`
          : `Playback is ready with ${frames.length} execution frame${frames.length === 1 ? "" : "s"}.`,
    error: traceIssue,
  };

  logger?.trace("Trace frame materialization completed.", {
    phase: "trace",
    details: {
      frameCount: frames.length,
      traceQuality: trace.traceSummary.quality,
      traceSource: trace.traceSummary.source,
      traceStatus: trace.traceSummary.status,
      usedFallback: shouldFallback,
      traceIssue,
    },
  });

  if (runCompleted && frames.length === 0) {
    logger?.warn("Execution finished but no trace frames were available after materialization.", {
      phase: "trace",
      details: {
        traceIssue,
      },
    });
  }

  return trace;
};
