import type { ExecutionTrace, SupportedLanguage } from "../types/execution";
import { env } from "../config/env";
import { ExecutionQueue } from "../executors/executionQueue";
import { executionInfrastructureConfig } from "../executors/languageConfigs";
import { createStructuredLogger } from "../logging/logger";
import { executeLocally } from "../executors/localExecutor";
import { executeRemotely } from "./remoteExecutorService";

const executionQueue = new ExecutionQueue(
  executionInfrastructureConfig.queueConcurrency,
  executionInfrastructureConfig.queueDepthLimit,
);

export const executeCodeDirect = async (
  code: string,
  language: SupportedLanguage,
  stdin = "",
): Promise<ExecutionTrace> => {
  return executionQueue.enqueue(async (queueTimeMs) => {
    const logger = createStructuredLogger({
      scope: "EXECUTION_SERVICE",
      defaultContext: {
        language,
        details: {
          queueTimeMs,
          stdinBytes: Buffer.byteLength(stdin, "utf8"),
          sourceBytes: Buffer.byteLength(code, "utf8"),
        },
      },
    });

    logger.runtime("Execution request dequeued.", {
      phase: "system",
    });

    try {
      const trace = await executeLocally(code, language, stdin, queueTimeMs);
      logger.runtime("Execution request completed.", {
        phase: trace.failurePhase ?? "system",
        durationMs: trace.executionTime,
        details: {
          status: trace.status,
          diagnosticCount: trace.diagnostics.length,
          logEntryCount: trace.logs.entries.length,
        },
      });
      return trace;
    } catch (error) {
      logger.error("Execution request crashed before a trace was returned.", error, {
        phase: "system",
      });
      throw error;
    }
  });
};

export const executeCode = async (
  code: string,
  language: SupportedLanguage,
  stdin = "",
): Promise<ExecutionTrace> => {
  if (env.executorMode === "remote") {
    return executeRemotely(code, language, stdin);
  }

  return executeCodeDirect(code, language, stdin);
};
