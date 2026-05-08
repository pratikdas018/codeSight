import compression from "compression";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { executeCodeDirect } from "./services/executeService";
import { isSupportedLanguage, supportedLanguages } from "./types/execution";

const executorApp = express();

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

executorApp.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "executor",
    mode: env.executionProvider,
  });
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

  if (!code.trim()) {
    return response.status(400).json({
      message: "Code is required.",
    });
  }

  if (!isSupportedLanguage(language)) {
    return response.status(400).json({
      message: `Unsupported language. Choose one of: ${supportedLanguages.join(", ")}.`,
    });
  }

  try {
    const result = await executeCodeDirect(code, language);
    return response.json(result);
  } catch (error) {
    return response.status(503).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to execute code right now.",
    });
  }
});

executorApp.use((_request, response) => {
  response.status(404).json({ message: "Route not found." });
});

export default executorApp;
