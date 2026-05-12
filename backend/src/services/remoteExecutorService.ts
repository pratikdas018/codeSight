import type { ExecutionTrace, SupportedLanguage } from "../types/execution";
import { env, requireRemoteExecutorConfig } from "../config/env";

interface RemoteErrorPayload {
  message?: string;
}

export const executeRemotely = async (
  code: string,
  language: SupportedLanguage,
  stdin = "",
): Promise<ExecutionTrace> => {
  requireRemoteExecutorConfig();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    env.remoteExecutorTimeoutMs,
  );

  try {
    const response = await fetch(env.remoteExecutorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-executor-token": env.executorSharedSecret,
      },
      body: JSON.stringify({ code, language, stdin }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as
      | ExecutionTrace
      | RemoteErrorPayload;

    if (!response.ok) {
      throw new Error(
        "message" in payload && payload.message
          ? payload.message
          : "Remote executor request failed.",
      );
    }

    return payload as ExecutionTrace;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Remote executor timed out after ${env.remoteExecutorTimeoutMs}ms.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
};
