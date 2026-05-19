import type {
  ParsedArrayValue,
  ParsedMemoryValue,
  ParsedObjectValue,
  ParsedReferenceValue,
} from "../memory/types";

const nullLiterals = new Set([
  "null",
  "nullptr",
  "nil",
  "none",
  "undefined",
]);

const numericPattern = /^-?\d+(?:\.\d+)?$/;
const addressPattern = /^0x[0-9a-f]+$/i;
const quotedPattern = /^(["'])([\s\S]*)\1$/;

export const splitTopLevel = (value: string, delimiter: string) => {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1];

    if ((character === "'" || character === '"') && previous !== "\\") {
      quote = quote === character ? null : quote ?? character;
    }

    if (!quote) {
      if (character === "[" || character === "{" || character === "(") {
        depth += 1;
      } else if (character === "]" || character === "}" || character === ")") {
        depth -= 1;
      } else if (character === delimiter && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }

    current += character;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
};

const stripQuotes = (value: string) => {
  const match = value.match(quotedPattern);
  return match ? match[2] : value;
};

const looksLikeTopLevelMap = (value: string) =>
  splitTopLevel(value, ",").some((part) => {
    const colonParts = splitTopLevel(part, ":");
    return colonParts.length > 1 || part.includes("=");
  });

const parseReferenceValue = (
  value: string,
  referenceKind: ParsedReferenceValue["referenceKind"] = "pointer",
): ParsedReferenceValue => {
  const trimmed = value.trim();

  if (nullLiterals.has(trimmed.toLowerCase())) {
    return {
      kind: "reference",
      display: trimmed || "null",
      referenceKind,
      nullish: true,
    };
  }

  if (addressPattern.test(trimmed)) {
    return {
      kind: "reference",
      display: trimmed,
      addressHint: trimmed.toLowerCase(),
      referenceKind,
      nullish: false,
    };
  }

  return {
    kind: "reference",
    display: trimmed,
    targetKey: trimmed.replace(/^&/, "").trim(),
    referenceKind,
    nullish: false,
  };
};

const parseObjectEntries = (content: string) =>
  splitTopLevel(content, ",")
    .map((part, index) => {
      const colonParts = splitTopLevel(part, ":");

      if (colonParts.length > 1) {
        const [rawKey, ...rawValueParts] = colonParts;
        return {
          key: stripQuotes(rawKey ?? `field${index}`),
          value: parseMemoryValue(rawValueParts.join(":").trim() || "undefined"),
        };
      }

      const equalIndex = part.indexOf("=");
      if (equalIndex > 0) {
        return {
          key: part.slice(0, equalIndex).trim(),
          value: parseMemoryValue(part.slice(equalIndex + 1).trim() || "undefined"),
        };
      }

      return {
        key: `field${index}`,
        value: parseMemoryValue(part),
      };
    })
    .filter((entry) => entry.key);

const parseTypedObjectOrArray = (
  typeName: string,
  content: string,
): ParsedObjectValue | ParsedArrayValue => {
  if (looksLikeTopLevelMap(content)) {
    return {
      kind: "object",
      display: `${typeName}{${content}}`,
      typeName,
      entries: parseObjectEntries(content),
    };
  }

  const items = content
    ? splitTopLevel(content, ",").map((part) => parseMemoryValue(part))
    : [];

  return {
    kind: "array",
    display: `${typeName}{${content}}`,
    items,
    collectionType: /vector|list/i.test(typeName) ? "vector" : "array",
    typeName,
  };
};

export const parseMemoryValue = (rawValue: string): ParsedMemoryValue => {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return {
      kind: "primitive",
      display: "empty",
    };
  }

  if (nullLiterals.has(trimmed.toLowerCase())) {
    return {
      kind: "null",
      display: trimmed,
    };
  }

  if (trimmed.startsWith("&")) {
    return parseReferenceValue(trimmed, "reference");
  }

  if (addressPattern.test(trimmed)) {
    return parseReferenceValue(trimmed);
  }

  const typedObjectMatch = trimmed.match(
    /^([A-Za-z_][\w:<>]*)\s*\{([\s\S]*)\}$/,
  );
  if (typedObjectMatch) {
    return parseTypedObjectOrArray(typedObjectMatch[1], typedObjectMatch[2].trim());
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const content = trimmed.slice(1, -1).trim();
    const items = content
      ? splitTopLevel(content, ",").map((part) => parseMemoryValue(part))
      : [];

    return {
      kind: "array",
      display: trimmed,
      items,
      collectionType: "array",
    };
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const content = trimmed.slice(1, -1).trim();

    if (!looksLikeTopLevelMap(content)) {
      const items = content
        ? splitTopLevel(content, ",").map((part) => parseMemoryValue(part))
        : [];

      return {
        kind: "array",
        display: trimmed,
        items,
        collectionType: "array",
      };
    }

    return {
      kind: "object",
      display: trimmed,
      entries: parseObjectEntries(content),
    };
  }

  if (quotedPattern.test(trimmed)) {
    return {
      kind: "primitive",
      display: stripQuotes(trimmed),
    };
  }

  if (trimmed === "true" || trimmed === "false") {
    return {
      kind: "primitive",
      display: trimmed,
      booleanValue: trimmed === "true",
    };
  }

  if (numericPattern.test(trimmed)) {
    return {
      kind: "primitive",
      display: trimmed,
      numericValue: Number(trimmed),
    };
  }

  return {
    kind: "primitive",
    display: trimmed,
  };
};

export const inferCollectionType = (
  label: string,
  typeName?: string,
): "array" | "vector" => {
  if (/vector|std::vector|dynamic/i.test(typeName ?? label)) {
    return "vector";
  }

  return "array";
};

export const inferHeapBlockKind = (
  label: string,
  value: ParsedMemoryValue,
): "array" | "vector" | "object" | "linked-node" | "tree-node" | "class" => {
  if (value.kind === "array") {
    return inferCollectionType(label, value.typeName);
  }

  const fingerprint = `${label} ${value.kind === "object" ? value.typeName ?? "" : ""}`;

  if (/node|list/i.test(fingerprint)) {
    return "linked-node";
  }

  if (/tree|bst|trie/i.test(fingerprint)) {
    return "tree-node";
  }

  if (value.kind === "object" && value.typeName) {
    return "class";
  }

  return "object";
};

export const inferValueTypeLabel = (value: ParsedMemoryValue): string => {
  if (value.kind === "array") {
    return value.collectionType;
  }

  if (value.kind === "object") {
    return value.typeName ?? "object";
  }

  if (value.kind === "reference") {
    return value.referenceKind;
  }

  if (value.kind === "null") {
    return "null";
  }

  if (typeof value.numericValue === "number") {
    return Number.isInteger(value.numericValue) ? "int" : "number";
  }

  if (typeof value.booleanValue === "boolean") {
    return "bool";
  }

  return "value";
};
