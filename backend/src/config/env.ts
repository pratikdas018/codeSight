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
    20_000,
  ),
  executorSharedSecret: process.env.EXECUTOR_SHARED_SECRET?.trim() ?? "",
  executionProvider: (process.env.EXECUTION_PROVIDER ?? "auto").toLowerCase(),
  logLevel: process.env.LOG_LEVEL ?? "info",
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
