import type { ExecutionStep, VariableSnapshot } from "../engine/types";
import type { ParsedValue } from "../visualization/types";

export type VariableChangeKind = "added" | "updated" | "removed" | "unchanged";

export interface NormalizedExecutionVariable {
  id: string;
  name: string;
  scope: string;
  rawValue: string;
  parsedValue: ParsedValue;
}

export interface VariablePathDiff {
  path: string;
  kind: Exclude<VariableChangeKind, "unchanged">;
  before?: string;
  after?: string;
  depth: number;
}

export interface VariableDiffEntry {
  id: string;
  name: string;
  scope: string;
  kind: VariableChangeKind;
  before?: string;
  after?: string;
  previousValue?: string;
  currentValue?: string;
  previousParsed?: ParsedValue;
  currentParsed?: ParsedValue;
  valueType: string;
  isComposite: boolean;
  present: boolean;
  changeCount: number;
  changes: VariablePathDiff[];
  summary: string;
}

export interface ExecutionFrameComparison {
  added: VariableDiffEntry[];
  updated: VariableDiffEntry[];
  removed: VariableDiffEntry[];
  unchanged: VariableDiffEntry[];
  all: VariableDiffEntry[];
  lookup: Map<string, VariableDiffEntry>;
  stats: {
    added: number;
    updated: number;
    removed: number;
    unchanged: number;
    changed: number;
  };
}

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

export const parseRuntimeValue = (value: string): ParsedValue => {
  const trimmedValue = value.trim();

  if (trimmedValue.startsWith("[") && trimmedValue.endsWith("]")) {
    const content = trimmedValue.slice(1, -1).trim();
    const items = content ? splitTopLevel(content, ",").map(parseRuntimeValue) : [];

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
            value: parseRuntimeValue(rawEntryValue || "undefined"),
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

  if (
    trimmedValue === "true" ||
    trimmedValue === "false" ||
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

const normalizeStepVariables = (
  variables: ExecutionStep["variables"] | null | undefined,
): VariableSnapshot[] => {
  if (!variables) {
    return [];
  }

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

export const normalizeExecutionVariables = (
  step: ExecutionStep | null,
): NormalizedExecutionVariable[] =>
  normalizeStepVariables(step?.variables).map((variable) => ({
    id: `${variable.scope}:${variable.name}`,
    name: variable.name,
    scope: variable.scope,
    rawValue: variable.value,
    parsedValue: parseRuntimeValue(variable.value),
  }));

export const inferRuntimeValueType = (rawValue: string, parsedValue: ParsedValue) => {
  if (parsedValue.kind === "array") {
    return "array";
  }

  if (parsedValue.kind === "object") {
    return "object";
  }

  const trimmedValue = rawValue.trim();

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return "string";
  }

  if (trimmedValue === "true" || trimmedValue === "false") {
    return "boolean";
  }

  if (trimmedValue === "null" || trimmedValue === "None") {
    return "null";
  }

  if (trimmedValue === "undefined") {
    return "undefined";
  }

  if (
    parsedValue.kind === "primitive" &&
    typeof parsedValue.numericValue === "number"
  ) {
    return Number.isInteger(parsedValue.numericValue) ? "integer" : "number";
  }

  return "value";
};

const buildChildPath = (parentPath: string, childKey: string) => {
  if (childKey.startsWith("[")) {
    return `${parentPath}${childKey}`;
  }

  return `${parentPath}.${childKey}`;
};

const getPathDepth = (path: string) => {
  const dotDepth = path.split(".").length - 1;
  const bracketDepth = (path.match(/\[/g) ?? []).length;
  return dotDepth + bracketDepth;
};

const createPathDiff = (
  path: string,
  kind: VariablePathDiff["kind"],
  before?: string,
  after?: string,
): VariablePathDiff => ({
  path,
  kind,
  before,
  after,
  depth: getPathDepth(path),
});

const getObjectEntryValue = (value: ParsedValue, key: string) => {
  if (value.kind !== "object") {
    return undefined;
  }

  return value.entries.find((entry) => entry.key === key)?.value;
};

const getOrderedObjectKeys = (previousValue: ParsedValue, currentValue: ParsedValue) => {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const source of [currentValue, previousValue]) {
    if (source.kind !== "object") {
      continue;
    }

    for (const entry of source.entries) {
      if (!seen.has(entry.key)) {
        seen.add(entry.key);
        keys.push(entry.key);
      }
    }
  }

  return keys;
};

const collectNestedDiffs = (
  previousValue: ParsedValue | undefined,
  currentValue: ParsedValue | undefined,
  path: string,
  diffs: VariablePathDiff[],
) => {
  if (!previousValue && !currentValue) {
    return;
  }

  if (!previousValue && currentValue) {
    diffs.push(createPathDiff(path, "added", undefined, currentValue.display));
    return;
  }

  if (previousValue && !currentValue) {
    diffs.push(createPathDiff(path, "removed", previousValue.display, undefined));
    return;
  }

  if (!previousValue || !currentValue) {
    return;
  }

  if (previousValue.kind !== currentValue.kind) {
    diffs.push(
      createPathDiff(path, "updated", previousValue.display, currentValue.display),
    );
    return;
  }

  if (previousValue.kind === "primitive" && currentValue.kind === "primitive") {
    if (previousValue.display !== currentValue.display) {
      diffs.push(
        createPathDiff(path, "updated", previousValue.display, currentValue.display),
      );
    }
    return;
  }

  if (previousValue.kind === "array" && currentValue.kind === "array") {
    const maxLength = Math.max(
      previousValue.items.length,
      currentValue.items.length,
    );

    for (let index = 0; index < maxLength; index += 1) {
      collectNestedDiffs(
        previousValue.items[index],
        currentValue.items[index],
        buildChildPath(path, `[${index}]`),
        diffs,
      );
    }
    return;
  }

  if (previousValue.kind === "object" && currentValue.kind === "object") {
    for (const key of getOrderedObjectKeys(previousValue, currentValue)) {
      collectNestedDiffs(
        getObjectEntryValue(previousValue, key),
        getObjectEntryValue(currentValue, key),
        buildChildPath(path, key),
        diffs,
      );
    }
    return;
  }

  if (previousValue.display !== currentValue.display) {
    diffs.push(
      createPathDiff(path, "updated", previousValue.display, currentValue.display),
    );
  }
};

const formatChangeSnippet = (change: VariablePathDiff) => {
  if (change.kind === "added") {
    return `${change.path}: ${change.after ?? "initialized"}`;
  }

  if (change.kind === "removed") {
    return `${change.path}: removed (${change.before ?? "value"})`;
  }

  return `${change.path}: ${change.before ?? "?"} -> ${change.after ?? "?"}`;
};

const formatChangeSummary = (
  name: string,
  kind: VariableChangeKind,
  changes: VariablePathDiff[],
  previousValue?: string,
  currentValue?: string,
) => {
  if (kind === "added") {
    return `${name} initialized as ${currentValue ?? "value"}`;
  }

  if (kind === "removed") {
    return `${name} was removed from the current frame`;
  }

  if (kind === "unchanged") {
    return `${name} stayed stable on this step`;
  }

  if (changes.length === 0) {
    return `${name}: ${previousValue ?? "?"} -> ${currentValue ?? "?"}`;
  }

  return changes.slice(0, 3).map(formatChangeSnippet).join(" | ");
};

const buildDiffEntry = (
  previousVariable: NormalizedExecutionVariable | undefined,
  currentVariable: NormalizedExecutionVariable | undefined,
): VariableDiffEntry => {
  const referenceVariable = currentVariable ?? previousVariable;
  const changes: VariablePathDiff[] = [];
  const name = referenceVariable?.name ?? "variable";
  const scope = referenceVariable?.scope ?? "global";
  const previousValue = previousVariable?.rawValue;
  const currentValue = currentVariable?.rawValue;
  const previousParsed = previousVariable?.parsedValue;
  const currentParsed = currentVariable?.parsedValue;

  if (!previousVariable && currentVariable) {
    changes.push(createPathDiff(name, "added", undefined, currentValue));
  } else if (previousVariable && !currentVariable) {
    changes.push(createPathDiff(name, "removed", previousValue, undefined));
  } else {
    collectNestedDiffs(previousParsed, currentParsed, name, changes);
  }

  const kind: VariableChangeKind = !previousVariable
    ? "added"
    : !currentVariable
      ? "removed"
      : changes.length > 0
        ? "updated"
        : "unchanged";

  const activeRawValue = currentValue ?? previousValue ?? "undefined";
  const activeParsedValue = currentParsed ?? previousParsed ?? parseRuntimeValue("undefined");
  const isComposite =
    activeParsedValue.kind === "array" || activeParsedValue.kind === "object";

  return {
    id: referenceVariable?.id ?? `${scope}:${name}`,
    name,
    scope,
    kind,
    before: previousValue,
    after: currentValue,
    previousValue,
    currentValue,
    previousParsed,
    currentParsed,
    valueType: inferRuntimeValueType(activeRawValue, activeParsedValue),
    isComposite,
    present: Boolean(currentVariable),
    changeCount: changes.length,
    changes,
    summary: formatChangeSummary(
      name,
      kind,
      changes,
      previousValue,
      currentValue,
    ),
  };
};

export const compareExecutionFrames = (
  previousFrame: ExecutionStep | null,
  currentFrame: ExecutionStep | null,
): ExecutionFrameComparison => {
  const previousVariables = normalizeExecutionVariables(previousFrame);
  const currentVariables = normalizeExecutionVariables(currentFrame);
  const previousMap = new Map(previousVariables.map((variable) => [variable.id, variable]));
  const currentMap = new Map(currentVariables.map((variable) => [variable.id, variable]));
  const orderedIds = [
    ...currentVariables.map((variable) => variable.id),
    ...previousVariables
      .map((variable) => variable.id)
      .filter((id) => !currentMap.has(id)),
  ];

  const all = orderedIds.map((id) =>
    buildDiffEntry(previousMap.get(id), currentMap.get(id)),
  );
  const added = all.filter((entry) => entry.kind === "added");
  const updated = all.filter((entry) => entry.kind === "updated");
  const removed = all.filter((entry) => entry.kind === "removed");
  const unchanged = all.filter((entry) => entry.kind === "unchanged");

  return {
    added,
    updated,
    removed,
    unchanged,
    all,
    lookup: new Map(all.map((entry) => [entry.id, entry])),
    stats: {
      added: added.length,
      updated: updated.length,
      removed: removed.length,
      unchanged: unchanged.length,
      changed: added.length + updated.length + removed.length,
    },
  };
};
