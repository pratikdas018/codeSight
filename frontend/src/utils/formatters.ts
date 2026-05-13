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

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const formatDuration = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "--";
  }

  if (value < 1_000) {
    return `${Math.round(value)}ms`;
  }

  if (value < 10_000) {
    return `${(value / 1_000).toFixed(1)}s`;
  }

  return `${Math.round(value / 1_000)}s`;
};

export const formatMemoryUsage = (valueKb?: number | null) => {
  if (typeof valueKb !== "number" || !Number.isFinite(valueKb) || valueKb <= 0) {
    return "--";
  }

  if (valueKb < 1_024) {
    return `${Math.round(valueKb)} KB`;
  }

  return `${(valueKb / 1_024).toFixed(valueKb >= 10_240 ? 0 : 1)} MB`;
};
