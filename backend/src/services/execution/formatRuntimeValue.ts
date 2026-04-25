export const formatRuntimeValue = (value: unknown): string => {
  if (typeof value === "string") {
    return `"${value}"`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "undefined") {
    return "undefined";
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value as { kind?: string }).kind === "user-function"
  ) {
    return `[Function ${(value as { name?: string }).name ?? "anonymous"}]`;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => formatRuntimeValue(item)).join(", ")}]`;
  }

  if (typeof value === "function") {
    return "[Native Function]";
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return error instanceof Error ? error.message : "[Unserializable]";
  }
};
