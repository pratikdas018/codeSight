import type {
  ExecutionStep,
  ExecutionStatus,
  ExecutionTrace,
  TraceFrameQuality,
} from "../engine/types";
import { buildMemoryVisualizationModel } from "../memory/buildMemoryVisualizationModel";
import type {
  HeapBlockModel,
  MemoryDiffState,
  MemoryVisualizationModel,
  StackFrameModel,
} from "../memory/types";
import type { SupportedLanguage } from "../utils/types";
import {
  compareExecutionFrames,
  type ExecutionFrameComparison,
} from "../utils/executionDiff";
import { diffMemoryModels } from "../utils/memoryDiffEngine";
import { createVisualizationModel } from "./model";
import type { VisualizationModel } from "./types";

export interface ExecutionInspectorEntry {
  id: string;
  label: string;
  scope: string;
  type: string;
  address?: string;
  previousValue?: string;
  currentValue: string;
  change: "added" | "updated" | "removed" | "allocated" | "freed" | "unchanged";
  summary: string;
}

export interface ExecutionClassroomFrame {
  frameIndex: number;
  frameNumber: number;
  totalFrames: number;
  lineNumber: number | null;
  lineCode: string;
  explanation: string;
  functionName: string;
  eventLabel: string;
  trackedVariables: VisualizationModel["variables"];
  changedVariables: VisualizationModel["variables"];
  visualization: VisualizationModel;
  memory: MemoryVisualizationModel;
  variableComparison: ExecutionFrameComparison;
  activeStackFrame: StackFrameModel | null;
  heapBlocks: HeapBlockModel[];
  changedHeapBlocks: HeapBlockModel[];
  inspectorEntries: ExecutionInspectorEntry[];
  focusVariableId?: string;
  focusStackFrameId?: string;
  focusHeapBlockId?: string;
  focusInspectorId?: string;
  runtime: {
    status: ExecutionStatus;
    traceQuality: TraceFrameQuality;
    statusLabel: string;
    summary: string;
    consolePreview: string[];
    changedVariableCount: number;
    heapMutationCount: number;
    stackFrameCount: number;
    heapBlockCount: number;
  };
}

interface CreateExecutionClassroomFrameOptions {
  trace: ExecutionTrace;
  step: ExecutionStep | null;
  previousStep: ExecutionStep | null;
  steps: ExecutionStep[];
  currentStepIndex: number;
  codeLines: string[];
  language: SupportedLanguage;
}

const GENERIC_EXPLANATION_PATTERNS = [
  /this line executes/i,
  /this line updates value/i,
  /this line updates a value/i,
  /this line stores a value/i,
  /this line is part of the program flow/i,
  /this line checks a condition/i,
  /this line repeats a block of work/i,
  /this line sends information to the output/i,
  /this line defines a reusable block of code/i,
];

const LANGUAGE_KEYWORDS = new Set([
  "and",
  "auto",
  "bool",
  "boolean",
  "break",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "def",
  "default",
  "delete",
  "do",
  "double",
  "elif",
  "else",
  "enum",
  "false",
  "finally",
  "float",
  "for",
  "function",
  "if",
  "import",
  "in",
  "int",
  "interface",
  "let",
  "long",
  "main",
  "namespace",
  "new",
  "None",
  "null",
  "or",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "std",
  "string",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "undefined",
  "var",
  "void",
  "while",
]);

const statusLabelMap: Record<ExecutionStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  compile_error: "Compile error",
  runtime_missing: "Runtime missing",
  runtime_error: "Runtime error",
  timed_out: "Timed out",
  memory_limit: "Memory limit",
  trace_failure: "Trace failure",
  internal_error: "Internal error",
};

const operatorPhraseMap: Record<string, string> = {
  "=": "Stores",
  "+=": "Adds",
  "-=": "Subtracts",
  "*=": "Multiplies",
  "/=": "Divides",
  "%=": "Applies modulus from",
};

const getStepLineNumber = (step: ExecutionStep | null) => {
  const candidate =
    typeof step?.line === "number" && step.line > 0
      ? step.line
      : step?.lineNumber ?? 0;
  return candidate > 0 ? candidate : null;
};

const getActiveFunctionName = (step: ExecutionStep | null) => {
  const activeCall = [...(step?.functionCalls ?? [])]
    .sort((left, right) => right.depth - left.depth)
    .find((call) => call.event === "active" || call.event === "enter");

  if (activeCall?.name) {
    return activeCall.name;
  }

  const frameName = step?.stack?.[0]?.name;

  if (frameName && frameName !== "global") {
    return frameName;
  }

  return "global scope";
};

const normalizeLineCode = (step: ExecutionStep | null, codeLines: string[]) => {
  const lineNumber = getStepLineNumber(step);
  const inlineCode = step?.codeLine?.trim();

  if (inlineCode) {
    return inlineCode;
  }

  if (!lineNumber) {
    return "";
  }

  return codeLines[lineNumber - 1]?.trim() ?? "";
};

const sentenceCase = (value: string) =>
  value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;

const trimTrailingPunctuation = (value: string) => value.replace(/[;,\s]+$/, "");

const isSpecificExplanation = (value: string | undefined) =>
  Boolean(
    value &&
      value.trim().length > 0 &&
      !GENERIC_EXPLANATION_PATTERNS.some((pattern) => pattern.test(value)),
  );

const collectIdentifiers = (lineCode: string) => {
  const matches = lineCode.match(/[A-Za-z_]\w*/g) ?? [];
  const identifiers: string[] = [];
  const seen = new Set<string>();

  for (const token of matches) {
    if (LANGUAGE_KEYWORDS.has(token)) {
      continue;
    }

    if (!seen.has(token)) {
      seen.add(token);
      identifiers.push(token);
    }
  }

  return identifiers;
};

const formatRuntimeFacts = (
  variableLookup: Map<string, VisualizationModel["variables"][number]>,
  changedVariables: VisualizationModel["variables"],
  identifiers: string[],
) => {
  const facts: string[] = [];
  const seen = new Set<string>();

  for (const variable of changedVariables) {
    if (seen.has(variable.name)) {
      continue;
    }

    seen.add(variable.name);
    if (variable.previousValue && variable.change === "updated") {
      facts.push(`${variable.name} ${variable.previousValue} -> ${variable.currentValue}`);
    } else {
      facts.push(`${variable.name} = ${variable.currentValue}`);
    }
  }

  for (const identifier of identifiers) {
    if (seen.has(identifier)) {
      continue;
    }

    const variable = variableLookup.get(identifier);
    if (!variable || !variable.present) {
      continue;
    }

    seen.add(identifier);
    facts.push(`${identifier} = ${variable.currentValue}`);
    if (facts.length >= 3) {
      break;
    }
  }

  return facts.slice(0, 3);
};

const buildRuntimeSuffix = (
  variableLookup: Map<string, VisualizationModel["variables"][number]>,
  changedVariables: VisualizationModel["variables"],
  identifiers: string[],
) => {
  const facts = formatRuntimeFacts(variableLookup, changedVariables, identifiers);

  if (facts.length === 0) {
    return "";
  }

  return ` Runtime now: ${facts.join(", ")}.`;
};

const buildConditionExplanation = (
  lineCode: string,
  step: ExecutionStep | null,
  functionName: string,
) => {
  const condition = trimTrailingPunctuation(
    lineCode
      .replace(/^if\s*\(/, "")
      .replace(/^if\s+/, "")
      .replace(/^while\s*\(/, "")
      .replace(/^while\s+/, "")
      .replace(/\)\s*\{?$/, "")
      .replace(/\{$/, ""),
  );
  const outcome =
    step?.eventType === "CONDITION_TRUE"
      ? "It evaluates to true, so execution continues down this branch."
      : step?.eventType === "CONDITION_FALSE"
        ? "It evaluates to false, so CodeSight follows the alternate path."
        : "This check decides which path the program takes next.";

  return `Checks ${condition || "the current condition"} inside ${functionName}. ${outcome}`;
};

const buildLoopExplanation = (
  lineCode: string,
  functionName: string,
  variableLookup: Map<string, VisualizationModel["variables"][number]>,
) => {
  const identifiers = collectIdentifiers(lineCode)
    .map((identifier) => variableLookup.get(identifier))
    .filter(
      (
        variable,
      ): variable is VisualizationModel["variables"][number] => Boolean(variable),
    )
    .slice(0, 2)
    .map((variable) => `${variable.name} = ${variable.currentValue}`);

  const runtimeContext =
    identifiers.length > 0 ? ` Current loop state: ${identifiers.join(", ")}.` : "";

  return `Advances the loop in ${functionName} and prepares the next iteration.${runtimeContext}`;
};

const buildOutputExplanation = (
  lineCode: string,
  consolePreview: string[],
) => {
  const latestOutput = consolePreview[consolePreview.length - 1];
  if (latestOutput) {
    return `Sends the result of ${trimTrailingPunctuation(lineCode)} to the console. Latest output: ${latestOutput}.`;
  }

  return `Sends the result of ${trimTrailingPunctuation(lineCode)} to the console.`;
};

const buildReturnExplanation = (
  lineCode: string,
  functionName: string,
  variableLookup: Map<string, VisualizationModel["variables"][number]>,
) => {
  const expression = trimTrailingPunctuation(
    lineCode.replace(/^return\s+/, "").replace(/^return$/, "control"),
  );
  const identifiers = collectIdentifiers(expression);
  const facts = formatRuntimeFacts(variableLookup, [], identifiers);
  const suffix = facts.length > 0 ? ` Runtime values: ${facts.join(", ")}.` : "";
  return `Returns ${expression} from ${functionName}.${suffix}`;
};

const buildDefinitionExplanation = (lineCode: string) => {
  const match =
    lineCode.match(/(?:def|function)\s+([A-Za-z_]\w*)/) ??
    lineCode.match(/([A-Za-z_]\w*)\s+main\s*\(/) ??
    lineCode.match(/([A-Za-z_]\w*)\s*\(/);
  const name = match?.[1] ?? "this routine";
  return `Defines ${name} so the runtime can call it later when execution reaches that path.`;
};

const buildAssignmentExplanation = (
  lineCode: string,
  variableLookup: Map<string, VisualizationModel["variables"][number]>,
  changedVariables: VisualizationModel["variables"],
) => {
  const assignmentMatch = lineCode.match(
    /^(.+?)\s*(\+=|-=|\*=|\/=|%=|=)\s*(.+)$/,
  );

  if (!assignmentMatch) {
    return null;
  }

  const leftSide = trimTrailingPunctuation(assignmentMatch[1].trim());
  const operator = assignmentMatch[2];
  const rightSide = trimTrailingPunctuation(assignmentMatch[3].trim());
  const targetName = leftSide.match(/[A-Za-z_]\w*/)?.[0];
  const targetVariable = targetName ? variableLookup.get(targetName) : undefined;
  const targetChange = targetName
    ? changedVariables.find((variable) => variable.name === targetName)
    : undefined;
  const identifiers = collectIdentifiers(lineCode).filter(
    (identifier) => identifier !== targetName,
  );
  const runtimeFacts = formatRuntimeFacts(variableLookup, [], identifiers);
  const targetPhrase =
    operator === "="
      ? `${operatorPhraseMap[operator]} ${rightSide} in ${leftSide}.`
      : `${operatorPhraseMap[operator]} ${rightSide} ${operator === "-=" ? "from" : "to"} ${leftSide}.`;
  const targetChangePhrase =
    targetChange?.previousValue && targetVariable
      ? ` ${targetName} moves from ${targetChange.previousValue} to ${targetVariable.currentValue}.`
      : targetVariable
        ? ` ${targetName} is now ${targetVariable.currentValue}.`
        : "";
  const runtimePhrase =
    runtimeFacts.length > 0 ? ` Related values: ${runtimeFacts.join(", ")}.` : "";

  return `${targetPhrase}${targetChangePhrase}${runtimePhrase}`.trim();
};

const buildFallbackExplanation = (
  lineCode: string,
  variableLookup: Map<string, VisualizationModel["variables"][number]>,
  changedVariables: VisualizationModel["variables"],
) => {
  const identifiers = collectIdentifiers(lineCode);
  const facts = formatRuntimeFacts(variableLookup, changedVariables, identifiers);
  const runtimePhrase = facts.length > 0 ? ` Runtime now: ${facts.join(", ")}.` : "";

  return `Executes ${trimTrailingPunctuation(lineCode) || "the current statement"}.${runtimePhrase}`.trim();
};

const buildGeneratedExplanation = (
  lineCode: string,
  step: ExecutionStep | null,
  functionName: string,
  variableLookup: Map<string, VisualizationModel["variables"][number]>,
  changedVariables: VisualizationModel["variables"],
  consolePreview: string[],
) => {
  const trimmed = lineCode.trim();

  if (!trimmed) {
    return "Press Run and CodeSight will explain each frame with synchronized runtime state.";
  }

  if (
    trimmed.startsWith("for ") ||
    trimmed.startsWith("for(") ||
    trimmed.startsWith("while ") ||
    trimmed.startsWith("while(")
  ) {
    return buildLoopExplanation(trimmed, functionName, variableLookup);
  }

  if (trimmed.startsWith("if ") || trimmed.startsWith("if(")) {
    return buildConditionExplanation(trimmed, step, functionName);
  }

  if (
    trimmed.includes("print(") ||
    trimmed.includes("console.log") ||
    trimmed.includes("printf(") ||
    trimmed.includes("System.out.println")
  ) {
    return buildOutputExplanation(trimmed, consolePreview);
  }

  if (trimmed.startsWith("return")) {
    return buildReturnExplanation(trimmed, functionName, variableLookup);
  }

  if (
    trimmed.startsWith("def ") ||
    trimmed.startsWith("function ") ||
    /\bmain\s*\(/.test(trimmed)
  ) {
    return buildDefinitionExplanation(trimmed);
  }

  const assignmentExplanation = buildAssignmentExplanation(
    trimmed,
    variableLookup,
    changedVariables,
  );
  if (assignmentExplanation) {
    return sentenceCase(assignmentExplanation);
  }

  return buildFallbackExplanation(trimmed, variableLookup, changedVariables);
};

const buildExplanation = ({
  authoredExplanation,
  authoredDescription,
  lineCode,
  step,
  functionName,
  variableLookup,
  changedVariables,
  consolePreview,
}: {
  authoredExplanation?: string;
  authoredDescription?: string;
  lineCode: string;
  step: ExecutionStep | null;
  functionName: string;
  variableLookup: Map<string, VisualizationModel["variables"][number]>;
  changedVariables: VisualizationModel["variables"];
  consolePreview: string[];
}) => {
  const identifiers = collectIdentifiers(lineCode);
  const authored = isSpecificExplanation(authoredExplanation)
    ? authoredExplanation?.trim()
    : isSpecificExplanation(authoredDescription)
      ? authoredDescription?.trim()
      : null;

  if (authored) {
    return `${authored}${buildRuntimeSuffix(variableLookup, changedVariables, identifiers)}`.trim();
  }

  return buildGeneratedExplanation(
    lineCode,
    step,
    functionName,
    variableLookup,
    changedVariables,
    consolePreview,
  );
};

const compareWeight = (
  left: VisualizationModel["variables"][number],
  right: VisualizationModel["variables"][number],
) => {
  const leftScore =
    Number(left.change !== "unchanged") * 3 +
    Number(left.isComposite) * 2 +
    Number(left.isPointer);
  const rightScore =
    Number(right.change !== "unchanged") * 3 +
    Number(right.isComposite) * 2 +
    Number(right.isPointer);

  return rightScore - leftScore;
};

const getChangeLabel = (state: MemoryDiffState): ExecutionInspectorEntry["change"] => {
  if (state === "allocated" || state === "freed" || state === "updated") {
    return state;
  }

  return "unchanged";
};

const buildInspectorEntries = ({
  trackedVariables,
  changedVariables,
  memory,
  previousMemory,
}: {
  trackedVariables: VisualizationModel["variables"];
  changedVariables: VisualizationModel["variables"];
  memory: MemoryVisualizationModel;
  previousMemory: MemoryVisualizationModel;
}) => {
  const entries: ExecutionInspectorEntry[] = [];
  const previousBlocks = new Map(
    previousMemory.heapBlocks.map((block) => [block.address, block]),
  );

  for (const variable of changedVariables) {
    entries.push({
      id: `variable:${variable.id}`,
      label: variable.name,
      scope: variable.scope,
      type: variable.valueType,
      previousValue: variable.previousValue,
      currentValue: variable.currentValue,
      change:
        variable.change === "added" ||
        variable.change === "removed" ||
        variable.change === "updated"
          ? variable.change
          : "unchanged",
      summary: variable.changeSummary,
    });
  }

  for (const block of memory.heapBlocks) {
    if (block.kind === "sentinel") {
      continue;
    }

    const previousBlock = previousBlocks.get(block.address);
    const changedCells = block.cells.filter((cell) => cell.diffState !== "unchanged");

    if (block.diffState !== "unchanged" && changedCells.length === 0) {
      entries.push({
        id: `heap:${block.id}`,
        label: block.title,
        scope: "heap",
        type: block.typeLabel,
        address: block.address,
        currentValue: block.summary,
        change: getChangeLabel(block.diffState),
        summary:
          block.diffState === "allocated"
            ? `${block.title} was allocated at ${block.address}.`
            : block.diffState === "freed"
              ? `${block.title} was released from ${block.address}.`
              : `${block.title} changed at ${block.address}.`,
      });
    }

    for (const cell of changedCells) {
      const previousCell = previousBlock?.cells.find(
        (candidate) => candidate.label === cell.label,
      );
      entries.push({
        id: `heap-cell:${block.id}:${cell.id}`,
        label: `${block.title}${cell.label.startsWith("[") ? cell.label : `.${cell.label}`}`,
        scope: "heap",
        type: cell.typeLabel,
        address: block.address,
        previousValue: previousCell?.displayValue,
        currentValue: cell.displayValue,
        change: getChangeLabel(cell.diffState),
        summary:
          cell.diffState === "allocated"
            ? `${cell.label} was created inside ${block.title}.`
            : cell.diffState === "updated"
              ? `${cell.label} changed from ${previousCell?.displayValue ?? "?"} to ${cell.displayValue}.`
              : `${cell.label} changed inside ${block.title}.`,
      });
    }
  }

  if (entries.length > 0) {
    return entries;
  }

  return trackedVariables.slice(0, 4).map((variable) => ({
    id: `stable:${variable.id}`,
    label: variable.name,
    scope: variable.scope,
    type: variable.valueType,
    currentValue: variable.currentValue,
    previousValue: variable.previousValue,
    change: "unchanged" as const,
    summary: `${variable.name} is currently ${variable.currentValue}.`,
  }));
};

export const createExecutionClassroomFrame = ({
  trace,
  step,
  previousStep,
  steps,
  currentStepIndex,
  codeLines,
  language,
}: CreateExecutionClassroomFrameOptions): ExecutionClassroomFrame => {
  const frameIndex = steps.length === 0 ? 0 : Math.min(currentStepIndex, steps.length - 1);
  const frameNumber = steps.length === 0 ? 0 : frameIndex + 1;
  const lineNumber = getStepLineNumber(step);
  const lineCode = normalizeLineCode(step, codeLines);
  const functionName = getActiveFunctionName(step);
  const variableComparison = compareExecutionFrames(previousStep, step);
  const visualization = createVisualizationModel(step, previousStep, variableComparison);
  const currentMemoryBase = buildMemoryVisualizationModel({ step });
  const previousMemoryBase = buildMemoryVisualizationModel({ step: previousStep });
  const memory = diffMemoryModels(previousMemoryBase, currentMemoryBase);
  const trackedVariables = [...visualization.variables].sort(compareWeight);
  const changedVariables = trackedVariables.filter(
    (variable) => variable.change !== "unchanged",
  );
  const heapBlocks = memory.heapBlocks.filter((block) => block.kind !== "sentinel");
  const changedHeapBlocks = heapBlocks.filter(
    (block) =>
      block.diffState !== "unchanged" ||
      block.cells.some((cell) => cell.diffState !== "unchanged"),
  );
  const variableLookup = new Map(
    trackedVariables.map((variable) => [variable.name, variable]),
  );
  const consolePreview =
    step?.stdout ??
    step?.output ??
    (steps.length > 0
      ? steps[steps.length - 1]?.stdout ?? steps[steps.length - 1]?.output ?? trace.outputLines
      : trace.outputLines);
  const explanation = buildExplanation({
    authoredExplanation: step?.explanation,
    authoredDescription: step?.description,
    lineCode,
    step,
    functionName,
    variableLookup,
    changedVariables,
    consolePreview,
  });
  const activeStackFrame =
    memory.stackFrames.find((frame) => frame.isActive) ?? null;
  const inspectorEntries = buildInspectorEntries({
    trackedVariables,
    changedVariables,
    memory,
    previousMemory: previousMemoryBase,
  });
  const fallbackSummary =
    steps.length === 0
      ? `Press Run to capture a ${language} execution timeline.`
      : `Frame ${frameNumber} is synchronized across code, variables, stack, heap, and runtime status.`;
  const runtimeSummary =
    step?.description?.trim() ||
    trace.traceSummary.message ||
    fallbackSummary;

  return {
    frameIndex,
    frameNumber,
    totalFrames: steps.length,
    lineNumber,
    lineCode,
    explanation,
    functionName,
    eventLabel: step?.eventType?.replace(/_/g, " ").toLowerCase() ?? "step",
    trackedVariables,
    changedVariables,
    visualization,
    memory,
    variableComparison,
    activeStackFrame,
    heapBlocks,
    changedHeapBlocks,
    inspectorEntries,
    focusVariableId: changedVariables[0]?.id ?? trackedVariables[0]?.id,
    focusStackFrameId:
      memory.stackFrames.find((frame) => frame.diffState !== "unchanged")?.id ??
      activeStackFrame?.id,
    focusHeapBlockId: changedHeapBlocks[0]?.id ?? heapBlocks[0]?.id,
    focusInspectorId: inspectorEntries[0]?.id,
    runtime: {
      status: trace.status,
      traceQuality: step?.traceQuality ?? trace.traceSummary.quality,
      statusLabel: statusLabelMap[trace.status],
      summary: runtimeSummary,
      consolePreview: consolePreview.slice(-3),
      changedVariableCount: variableComparison.stats.changed,
      heapMutationCount: memory.diff.mutatedValues,
      stackFrameCount: memory.stackFrames.length,
      heapBlockCount: heapBlocks.length,
    },
  };
};
