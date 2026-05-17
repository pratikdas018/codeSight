import compression from "compression";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { createStructuredLogger } from "./logging/logger";
import { executeCodeDirect } from "./services/executeService";
import {
  getRuntimeManagerSnapshot,
  primeRuntimeManagerSnapshot,
} from "./services/runtimeManagerService";
import {
  createEmptyExecutionTrace,
  isSupportedLanguage,
  supportedLanguages,
} from "./types/execution";

const executorApp = express();
primeRuntimeManagerSnapshot();

executorApp.disable("x-powered-by");
executorApp.set("trust proxy", env.trustProxy);
executorApp.use(
  pinoHttp({
    level: env.logLevel,
    quietReqLogger: !env.isProduction,
  }),
);
executorApp.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
executorApp.use(compression());
executorApp.use(express.json({ limit: env.bodyLimit }));

executorApp.get("/health", async (_request, response, next) => {
  try {
    const runtimeManager = await getRuntimeManagerSnapshot();
    response.json({
      status: "ok",
      service: "executor",
      mode: env.executionProvider,
      runtimeManager,
    });
  } catch (error) {
    next(error);
  }
});

executorApp.use((request, response, next) => {
  const token = request.headers["x-executor-token"];

  if (
    typeof token !== "string" ||
    !env.executorSharedSecret ||
    token !== env.executorSharedSecret
  ) {
    return response.status(401).json({ message: "Unauthorized executor request." });
  }

  return next();
});

executorApp.post("/internal/execute", async (request, response) => {
  const code = String(request.body.code ?? "");
  const language = String(request.body.language ?? "").trim().toLowerCase();
  const stdin = String(request.body.stdin ?? "");
  const logger = createStructuredLogger({
    scope: "EXECUTOR_APP",
    defaultContext: {
      phase: "system",
      details: {
        requestLanguage: language,
        sourceBytes: Buffer.byteLength(code, "utf8"),
        stdinBytes: Buffer.byteLength(stdin, "utf8"),
      },
    },
  });

  if (!code.trim()) {
    logger.warn("Rejected executor request because code was empty.");
    return response.status(400).json({
      message: "Code is required.",
    });
  }

  if (!isSupportedLanguage(language)) {
    logger.warn("Rejected executor request because the language was unsupported.", {
      details: {
        supportedLanguages: supportedLanguages.join(", "),
      },
    });
    return response.status(400).json({
      message: `Unsupported language. Choose one of: ${supportedLanguages.join(", ")}.`,
    });
  }

  try {
    logger.runtime("Accepted internal executor request.", {
      language,
    });
    const result = await executeCodeDirect(code, language, stdin);
    return response.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to execute code right now.";
    const trace = createEmptyExecutionTrace(language);
    trace.status = "internal_error";
    trace.error = message;
    trace.failurePhase = "system";
    trace.logs.system.push(message);
    logger.error("Internal executor request crashed before a trace response could be returned.", error, {
      language,
    });
    trace.diagnostics = [
      {
        category: "internal",
        phase: "system",
        severity: "error",
        source: "codesight-executor",
        summary: "CodeSight executor failed this request.",
        detail: message,
        raw: message,
      },
    ];
    return response.json(trace);
  }
});

executorApp.use((_request, response) => {
  response.status(404).json({ message: "Route not found." });
});

export default executorApp;
