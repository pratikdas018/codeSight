import type { SupportedLanguage } from "./types";
import type { ExecutionTrace } from "../engine/types";

export const API_BASE_URL =
  window.electronAPI?.env.backendUrl ??
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:4000";

const REQUEST_TIMEOUT_MS = 60_000;

const request = async <T>(path: string, options: RequestInit = {}) => {
  const { headers, ...rest } = options;
  const controller = new AbortController();
  const timeoutHandle = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const externalSignal = options.signal;
  const abortExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortExternal, { once: true });

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    } & T;

    if (!response.ok) {
      const error = new Error(payload.message ?? "Request failed.");
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The request timed out or was cancelled. Please try again.");
    }
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      throw new Error(
        `CodeSight could not reach its backend at ${API_BASE_URL}. Start the backend and try again.`,
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutHandle);
    externalSignal?.removeEventListener("abort", abortExternal);
  }
};

export const executeCodeRequest = (
  code: string,
  language: SupportedLanguage,
  stdin = "",
) =>
  window.electronAPI?.runCode
    ? window.electronAPI.runCode({ code, language, stdin })
    : request<ExecutionTrace>("/execute", {
        method: "POST",
        body: JSON.stringify({ code, language, stdin }),
      });

export interface RuntimeCommandStatus {
  key: "node" | "python" | "java" | "javac" | "gcc" | "g++";
  label: string;
  installed: boolean;
  command: string;
  version: string | null;
  error: string | null;
}

export interface RuntimeStatusItem {
  id: "nodejs" | "python" | "java" | "gcc" | "gpp";
  label: string;
  installed: boolean;
  version: string | null;
  guidance: string;
  commands: RuntimeCommandStatus[];
}

export interface RuntimeManagerSnapshot {
  checkedAt: string;
  installedCount: number;
  missingCount: number;
  items: RuntimeStatusItem[];
}

export interface RuntimeHealthPayload {
  status: "ok";
  service: string;
  executorMode: "local" | "remote";
  executionProvider: string;
  runtimeManager: RuntimeManagerSnapshot;
}

export const fetchRuntimeHealth = (signal?: AbortSignal) =>
  request<RuntimeHealthPayload>("/health", { signal });

export const fetchRuntimeManager = (options?: {
  signal?: AbortSignal;
  refresh?: boolean;
}) => {
  const query = options?.refresh ? "?refresh=1" : "";
  return request<RuntimeManagerSnapshot>(`/runtimes${query}`, {
    signal: options?.signal,
  });
};
