import type {
  ExecutionStep,
  StackFrameSnapshot,
  VariableSnapshot,
} from "../engine/types";
import type { ExecutionFrameComparison } from "../utils/executionDiff";
import {
  compareExecutionFrames,
  inferRuntimeValueType,
  normalizeExecutionVariables,
  parseRuntimeValue,
} from "../utils/executionDiff";
import type {
  HeapNode,
  MemoryLink,
  ParsedArrayValue,
  VisualArray,
  VisualStackFrame,
  VisualVariable,
  VisualizationModel,
} from "./types";

const pointerVariableNames = new Set([
  "i",
  "j",
  "k",
  "idx",
  "index",
  "left",
  "right",
  "low",
  "high",
  "mid",
  "pivot",
  "cursor",
  "pointer",
  "start",
  "end",
]);

const buildOccurrenceId = (values: string[]) => {
  const seenCounts = new Map<string, number>();

  return values.map((value) => {
    const currentCount = seenCounts.get(value) ?? 0;
    seenCounts.set(value, currentCount + 1);
    return `${value}::${currentCount}`;
  });
};

const isPointerCandidate = (variable: VisualVariable) =>
  pointerVariableNames.has(variable.name.toLowerCase()) &&
  Number.isInteger(variable.pointerIndex);

const buildHeapNode = (variable: VisualVariable): HeapNode | null => {
  if (variable.parsedValue.kind === "array") {
    return {
      id: `heap:${variable.id}`,
      label: `${variable.name}[]`,
      kind: "array",
      rows: variable.parsedValue.items.map((item, index) => ({
        id: `index:${index}`,
        key: `[${index}]`,
        value: item.display,
      })),
      emphasized: variable.emphasis,
    };
  }

  if (variable.parsedValue.kind === "object") {
    const rowIds = buildOccurrenceId(
      variable.parsedValue.entries.map((entry) => entry.key),
    );

    return {
      id: `heap:${variable.id}`,
      label: `${variable.name}{}`,
      kind: "object",
      rows: variable.parsedValue.entries.map((entry, index) => ({
        id: rowIds[index],
        key: entry.key,
        value: entry.value.display,
      })),
      emphasized: variable.emphasis,
    };
  }

  return null;
};

const getChangedArrayIndices = (
  currentValue: ParsedArrayValue,
  previousValue?: ParsedArrayValue,
) => {
  if (!previousValue || previousValue.kind !== "array") {
    return new Set(currentValue.items.map((_item, index) => index));
  }

  const changedIndices = new Set<number>();
  const maxLength = Math.max(currentValue.items.length, previousValue.items.length);

  for (let index = 0; index < maxLength; index += 1) {
    if (currentValue.items[index]?.display !== previousValue.items[index]?.display) {
      changedIndices.add(index);
    }
  }

  return changedIndices;
};

export const createVisualizationModel = (
  step: ExecutionStep | null,
  previousStep: ExecutionStep | null,
  comparison?: ExecutionFrameComparison,
): VisualizationModel => {
  const frameComparison = comparison ?? compareExecutionFrames(previousStep, step);
  const currentVariables = normalizeExecutionVariables(step);
  const currentVariableMap = new Map(
    currentVariables.map((variable) => [variable.id, variable]),
  );

  const visualVariables: VisualVariable[] = frameComparison.all.map((entry) => {
    const activeValue = entry.currentValue ?? entry.previousValue ?? "undefined";
    const currentDisplayValue = entry.present ? activeValue : "[deleted]";
    const parsedValue = entry.currentParsed ?? entry.previousParsed ?? parseRuntimeValue("undefined");
    const pointerIndex =
      parsedValue.kind === "primitive" &&
      typeof parsedValue.numericValue === "number" &&
      Number.isInteger(parsedValue.numericValue)
        ? parsedValue.numericValue
        : undefined;
    const isComposite = parsedValue.kind === "array" || parsedValue.kind === "object";

    return {
      id: entry.id,
      name: entry.name,
      scope: entry.scope,
      currentValue: currentDisplayValue,
      previousValue: entry.previousValue,
      valueType: inferRuntimeValueType(activeValue, parsedValue),
      parsedValue,
      change: entry.kind,
      present: entry.present,
      changeCount: entry.changeCount,
      diffPaths: entry.changes,
      changeSummary: entry.summary,
      isPointer:
        typeof pointerIndex === "number" &&
        pointerVariableNames.has(entry.name.toLowerCase()),
      pointerIndex,
      isComposite,
      emphasis: entry.kind !== "unchanged" || isComposite,
    };
  });

  const visualVariableMap = new Map(
    visualVariables.map((variable) => [variable.id, variable]),
  );

  const fallbackFrames = Array.from(
    new Set(currentVariables.map((variable) => variable.scope)),
  ).map((scopeName) => ({
    name: scopeName,
    locals: currentVariables
      .filter((variable) => variable.scope === scopeName)
      .map((variable) => ({
        name: variable.name,
        scope: variable.scope,
        value: variable.rawValue,
      })),
  }));

  const stackFrames: VisualStackFrame[] = (step?.stack ?? fallbackFrames).map(
    (frame: StackFrameSnapshot | { name: string; locals: VariableSnapshot[] }) => ({
      id: `frame:${frame.name}`,
      name: frame.name,
      locals: frame.locals
        .map((local) => visualVariableMap.get(`${local.scope}:${local.name}`))
        .filter((variable): variable is VisualVariable => Boolean(variable)),
      isActive: false,
      isGlobal: frame.name === "global",
    }),
  );

  if (stackFrames.length > 0) {
    stackFrames[0] = {
      ...stackFrames[0],
      isActive: true,
    };
  }

  const arrays: VisualArray[] = visualVariables
    .filter(
      (variable): variable is VisualVariable & { parsedValue: ParsedArrayValue } =>
        variable.present && variable.parsedValue.kind === "array",
    )
    .map((variable) => {
      const previousValue = variable.previousValue
        ? parseRuntimeValue(variable.previousValue)
        : undefined;
      const changedIndices =
        previousValue?.kind === "array"
          ? getChangedArrayIndices(variable.parsedValue, previousValue)
          : getChangedArrayIndices(variable.parsedValue);
      const occurrenceIds = buildOccurrenceId(
        variable.parsedValue.items.map((item) => item.display),
      );
      const pointers = visualVariables
        .filter(isPointerCandidate)
        .filter((pointer) =>
          typeof pointer.pointerIndex === "number" &&
          pointer.pointerIndex >= 0 &&
          pointer.pointerIndex < variable.parsedValue.items.length,
        )
        .map((pointer) => ({
          name: pointer.name,
          index: pointer.pointerIndex as number,
          active: pointer.change !== "unchanged",
        }));

      return {
        id: `array:${variable.id}`,
        name: variable.name,
        scope: variable.scope,
        items: variable.parsedValue.items.map((item, index) => ({
          motionId: `${variable.id}:${occurrenceIds[index]}`,
          index,
          label: item.display,
          changed: changedIndices.has(index),
        })),
        pointers,
        activeIndices: [...new Set(pointers.map((pointer) => pointer.index))],
      };
    });

  const heapNodes = visualVariables
    .filter((variable) => variable.present && variable.isComposite)
    .map(buildHeapNode)
    .filter((node): node is HeapNode => Boolean(node));

  const links: MemoryLink[] = visualVariables
    .filter((variable) => variable.present && variable.isComposite)
    .map((variable) => ({
      sourceId: variable.id,
      targetId: `heap:${variable.id}`,
      emphasized: variable.emphasis,
    }));

  const focusNames = visualVariables
    .filter(
      (variable) =>
        variable.change !== "unchanged" ||
        variable.isPointer ||
        variable.isComposite,
    )
    .map((variable) => variable.name);

  return {
    variables: visualVariables,
    stackFrames,
    arrays,
    heapNodes,
    links,
    explanation:
      step?.explanation ??
      step?.description ??
      "Run your code to generate animated execution insights.",
    focusNames,
  };
};
