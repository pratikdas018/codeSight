import type { ExecutionStep, VariableSnapshot } from "../engine/types";
import type {
  HeapNode,
  MemoryLink,
  ParsedArrayValue,
  ParsedObjectValue,
  ParsedValue,
  VisualArray,
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

const splitTopLevel = (value: string, delimiter: string) => {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previousChar = value[index - 1];

    if ((char === "'" || char === '"') && previousChar !== "\\") {
      if (quote === char) {
        quote = null;
      } else if (!quote) {
        quote = char;
      }
    }

    if (!quote) {
      if (char === "[" || char === "{" || char === "(") {
        depth += 1;
      } else if (char === "]" || char === "}" || char === ")") {
        depth -= 1;
      } else if (char === delimiter && depth === 0) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
};

const stripQuotes = (value: string) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
};

export const parseSerializedValue = (value: string): ParsedValue => {
  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("[") && trimmedValue.endsWith("]")) {
    const content = trimmedValue.slice(1, -1).trim();
    const items = content ? splitTopLevel(content, ",").map(parseSerializedValue) : [];

    return {
      kind: "array",
      display: trimmedValue,
      items,
    };
  }

  if (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) {
    const content = trimmedValue.slice(1, -1).trim();
    const entries = content
      ? splitTopLevel(content, ",").map((part) => {
          const [rawKey, ...valueParts] = splitTopLevel(part, ":");
          const normalizedKey = stripQuotes(rawKey ?? "entry");
          const rawEntryValue = valueParts.join(":").trim();

          return {
            key: normalizedKey,
            value: parseSerializedValue(rawEntryValue || "undefined"),
          };
        })
      : [];

    return {
      kind: "object",
      display: trimmedValue,
      entries,
    };
  }

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return {
      kind: "primitive",
      display: stripQuotes(trimmedValue),
    };
  }

  if (trimmedValue === "true" || trimmedValue === "false") {
    return {
      kind: "primitive",
      display: trimmedValue,
    };
  }

  if (
    trimmedValue === "null" ||
    trimmedValue === "undefined" ||
    trimmedValue === "None"
  ) {
    return {
      kind: "primitive",
      display: trimmedValue,
    };
  }

  const numericValue = Number(trimmedValue);

  if (Number.isFinite(numericValue)) {
    return {
      kind: "primitive",
      display: trimmedValue,
      numericValue,
    };
  }

  return {
    kind: "primitive",
    display: trimmedValue,
  };
};

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

const buildOccurrenceId = (values: string[]) => {
  const seenCounts = new Map<string, number>();

  return values.map((value) => {
    const currentCount = seenCounts.get(value) ?? 0;
    seenCounts.set(value, currentCount + 1);
    return `${value}::${currentCount}`;
  });
};

const getPreviousVariableMap = (step: ExecutionStep | null) =>
  new Map(
    normalizeVariables(step?.variables ?? []).map((variable) => [
      `${variable.scope}:${variable.name}`,
      variable.value,
    ]),
  );

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
        key: `[${index}]`,
        value: item.display,
      })),
      emphasized: variable.emphasis,
    };
  }

  if (variable.parsedValue.kind === "object") {
    return {
      id: `heap:${variable.id}`,
      label: `${variable.name}{}`,
      kind: "object",
      rows: variable.parsedValue.entries.map((entry) => ({
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
  previousValue?: ParsedArrayValue | ParsedObjectValue | ParsedValue,
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
): VisualizationModel => {
  const currentVariables = normalizeVariables(step?.variables ?? []);
  const previousVariables = getPreviousVariableMap(previousStep);

  const visualVariables: VisualVariable[] = currentVariables.map((variable) => {
    const previousValue = previousVariables.get(`${variable.scope}:${variable.name}`);
    const parsedValue = parseSerializedValue(variable.value);
    const pointerIndex =
      parsedValue.kind === "primitive" &&
      typeof parsedValue.numericValue === "number" &&
      Number.isInteger(parsedValue.numericValue)
        ? parsedValue.numericValue
        : undefined;
    const isComposite =
      parsedValue.kind === "array" || parsedValue.kind === "object";
    const change =
      typeof previousValue === "undefined"
        ? "added"
        : previousValue !== variable.value
          ? "updated"
          : "unchanged";

    return {
      id: `${variable.scope}:${variable.name}`,
      name: variable.name,
      scope: variable.scope,
      currentValue: variable.value,
      previousValue,
      parsedValue,
      change,
      isPointer:
        typeof pointerIndex === "number" &&
        pointerVariableNames.has(variable.name.toLowerCase()),
      pointerIndex,
      isComposite,
      emphasis: change !== "unchanged" || isComposite,
    };
  });

  const arrays: VisualArray[] = visualVariables
    .filter(
      (variable): variable is VisualVariable & { parsedValue: ParsedArrayValue } =>
        variable.parsedValue.kind === "array",
    )
    .map((variable) => {
      const previousValue = variable.previousValue
        ? parseSerializedValue(variable.previousValue)
        : undefined;
      const changedIndices = getChangedArrayIndices(variable.parsedValue, previousValue);
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
    .filter((variable) => variable.isComposite)
    .map(buildHeapNode)
    .filter((node): node is HeapNode => Boolean(node));

  const links: MemoryLink[] = visualVariables
    .filter((variable) => variable.isComposite)
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
