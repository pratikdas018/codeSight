import type { SupportedLanguage } from "./types";
import type { ExecutionTrace } from "../engine/types";

const API_BASE_URL =
  window.electronAPI?.env.backendUrl ??
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:4000";

const request = async <T>(path: string, options: RequestInit = {}) => {
  const { headers, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
  } & T;

  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed.");
  }

  return payload;
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
