import type { ExecutionTrace, SupportedLanguage } from "../types/execution";
import { executeInDocker } from "../executors/dockerExecutor";
import { executeLocally } from "../executors/localExecutor";
import { executeJavaScript } from "./execution/javascriptTraceService";

const executionProvider = (
  process.env.EXECUTION_PROVIDER ?? "auto"
).toLowerCase();

export const executeCode = async (
  code: string,
  language: SupportedLanguage,
): Promise<ExecutionTrace> => {
  const runLocal = () => executeLocally(code, language);

  if (executionProvider === "local") {
    return runLocal();
  }

  try {
    const execution = await executeInDocker(code, language);

    if (language === "javascript" && !execution.error && !execution.timedOut) {
      const trace = executeJavaScript(code);

      return {
        ...execution,
        steps: trace.steps,
      };
    }

    return execution;
  } catch (error) {
    if (executionProvider === "docker") {
      throw error;
    }

    return runLocal();
  }
};
