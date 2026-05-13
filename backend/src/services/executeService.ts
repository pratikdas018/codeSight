import type { ExecutionTrace, SupportedLanguage } from "../types/execution";
import { env } from "../config/env";
import { executeInDocker } from "../executors/dockerExecutor";
import { ExecutionQueue } from "../executors/executionQueue";
import { executionInfrastructureConfig } from "../executors/languageConfigs";
import { executeLocally } from "../executors/localExecutor";
import { executeRemotely } from "./remoteExecutorService";
import { executeJavaScript } from "./execution/javascriptTraceService";

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
    const runLocal = () => executeLocally(code, language, stdin, queueTimeMs);

    if (env.executionProvider === "local") {
      return runLocal();
    }

    try {
      const execution = await executeInDocker(code, language, stdin, queueTimeMs);

      if (
        language === "javascript" &&
        execution.status === "completed" &&
        !execution.stdin.provided
      ) {
        const trace = executeJavaScript(code);

        return {
          ...execution,
          steps: trace.steps,
        };
      }

      return execution;
    } catch (error) {
      if (env.executionProvider === "docker") {
        throw error;
      }

      return runLocal();
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
