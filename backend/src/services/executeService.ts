import type { ExecutionTrace, SupportedLanguage } from "../types/execution";
import { env } from "../config/env";
import { executeInDocker } from "../executors/dockerExecutor";
import { executeLocally } from "../executors/localExecutor";
import { executeRemotely } from "./remoteExecutorService";
import { executeJavaScript } from "./execution/javascriptTraceService";

export const executeCodeDirect = async (
  code: string,
  language: SupportedLanguage,
  stdin = "",
): Promise<ExecutionTrace> => {
  const runLocal = () => executeLocally(code, language, stdin);

  if (env.executionProvider === "local") {
    return runLocal();
  }

  try {
    const execution = await executeInDocker(code, language, stdin);

    if (language === "javascript" && !execution.error && !execution.timedOut) {
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
