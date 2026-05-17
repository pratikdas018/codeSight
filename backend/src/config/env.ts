const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const frontendOrigins = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const executorMode = (
  process.env.EXECUTOR_MODE ??
  (process.env.REMOTE_EXECUTOR_URL ? "remote" : "local")
).toLowerCase();

const parseLogLevel = (value: string | undefined) => {
  switch (value?.trim().toLowerCase()) {
    case "error":
    case "warn":
    case "info":
    case "debug":
      return value.trim().toLowerCase();
    default:
      return null;
  }
};

const verboseLoggingEnabled =
  process.env.CODESIGHT_VERBOSE_LOGS?.trim().toLowerCase() === "true";

const defaultLogLevel =
  parseLogLevel(process.env.CODESIGHT_LOG_LEVEL) ??
  parseLogLevel(process.env.LOG_LEVEL) ??
  (verboseLoggingEnabled
    ? "debug"
    : (process.env.NODE_ENV ?? "development") === "production"
      ? "error"
      : "warn");

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  port: parseNumber(process.env.PORT, 4000),
  bodyLimit: process.env.REQUEST_BODY_LIMIT ?? "1mb",
  frontendOrigins,
  trustProxy: process.env.TRUST_PROXY ?? "loopback",
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 60),
  executorMode: executorMode === "remote" ? "remote" : "local",
  remoteExecutorUrl: process.env.REMOTE_EXECUTOR_URL?.trim() ?? "",
  remoteExecutorTimeoutMs: parseNumber(
    process.env.REMOTE_EXECUTOR_TIMEOUT_MS,
    60_000,
  ),
  executorSharedSecret: process.env.EXECUTOR_SHARED_SECRET?.trim() ?? "",
  executionProvider: "local" as const,
  logLevel: defaultLogLevel,
};

export const requireRemoteExecutorConfig = () => {
  if (!env.remoteExecutorUrl) {
    throw new Error(
      "REMOTE_EXECUTOR_URL is required when EXECUTOR_MODE=remote.",
    );
  }

  if (!env.executorSharedSecret) {
    throw new Error(
      "EXECUTOR_SHARED_SECRET is required when EXECUTOR_MODE=remote.",
    );
  }
};

export const requireExecutorSecret = () => {
  if (!env.executorSharedSecret) {
    throw new Error("EXECUTOR_SHARED_SECRET is required for the executor service.");
  }
};
