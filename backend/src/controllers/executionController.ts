import { Request, Response } from "express";
import { createStructuredLogger } from "../logging/logger";
import { executeCode } from "../services/executeService";
import { ExecutionQueueFullError } from "../executors/executionQueue";
import { env } from "../config/env";
import {
  createEmptyExecutionTrace,
  isSupportedLanguage,
  supportedLanguages,
} from "../types/execution";

export const execute = async (request: Request, response: Response) => {
  const code = String(request.body.code ?? "");
  const language = String(request.body.language ?? "").trim().toLowerCase();
  const stdin = String(request.body.stdin ?? "");
  const logger = createStructuredLogger({
    scope: "EXECUTION_CONTROLLER",
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
    logger.warn("Rejected execution request because code was empty.");
    return response.status(400).json({
      message: "Code is required.",
    });
  }

  if (Buffer.byteLength(code, "utf8") > env.maxCodeBytes) {
    return response.status(413).json({
      message: `Code exceeds the ${Math.ceil(env.maxCodeBytes / 1024)} KB limit.`,
    });
  }

  if (Buffer.byteLength(stdin, "utf8") > env.maxStdinBytes) {
    return response.status(413).json({
      message: `Program input exceeds the ${Math.ceil(env.maxStdinBytes / 1024)} KB limit.`,
    });
  }

  if (!isSupportedLanguage(language)) {
    logger.warn("Rejected execution request because the language was unsupported.", {
      details: {
        supportedLanguages: supportedLanguages.join(", "),
      },
    });
    return response.status(400).json({
      message: `Unsupported language. Choose one of: ${supportedLanguages.join(", ")}.`,
    });
  }

  try {
    logger.runtime("Accepted execution request.", {
      language,
    });
    const result = await executeCode(code, language, stdin);
    return response.json(result);
  } catch (error) {
    if (error instanceof ExecutionQueueFullError) {
      response.setHeader("Retry-After", "5");
      return response.status(429).json({ message: error.message });
    }

    const message =
      !env.isProduction && error instanceof Error
        ? error.message
        : "Unable to execute code right now.";
    const trace = createEmptyExecutionTrace(language);
    trace.status = "internal_error";
    trace.error = message;
    trace.failurePhase = "system";
    trace.logs.system.push(message);
    logger.error("Execution request failed before a trace response could be returned.", error, {
      language,
    });
    trace.diagnostics = [
      {
        category: "internal",
        phase: "system",
        severity: "error",
        source: "codesight-api",
        summary: "CodeSight could not execute this request.",
        detail: message,
        raw: message,
      },
    ];
    return response.json(trace);
  }
};
